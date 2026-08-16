import { NextRequest, NextResponse } from 'next/server';
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import { pagamento, segredoDoWebhook } from '@/nucleo/checkouts/mercadopago';
import { processarNotificacaoDePagamento } from '@/lib/webhook-pagamento';

/**
 * Webhook do Mercado Pago — **a única fonte de verdade sobre pagamento**
 * (SPEC 10.6). O retorno do navegador não prova nada, e a resposta síncrona do
 * POST /v1/payments também não: um Pix volta `pending` e só vira `approved`
 * quando a pessoa efetivamente paga.
 *
 * Três regras do SPEC implementadas aqui:
 *  - validar a assinatura de todo webhook recebido
 *  - idempotência: o MP reenvia o mesmo evento várias vezes
 *  - o status vem de uma **consulta à API**, nunca do corpo da notificação.
 *    O corpo carrega só o `data.id`; aceitar um status vindo no corpo seria
 *    deixar qualquer um liberar acesso forjando um POST.
 */
export async function POST(req: NextRequest) {
  const dataIdQuery = req.nextUrl.searchParams.get('data.id');

  const naoAutorizado = validarAssinatura(req, dataIdQuery);
  if (naoAutorizado) return naoAutorizado;

  try {
    const corpo = await req.json();

    // `merchant_order` e outros tipos chegam no mesmo endpoint. Reconhecer sem
    // processar — devolver erro faria o MP retentar algo que nunca vai mudar.
    const tipo = corpo?.type ?? corpo?.topic;
    if (tipo !== 'payment') return NextResponse.json({ ok: true });

    const idPagamento = String(corpo?.data?.id ?? dataIdQuery ?? '');
    if (!idPagamento) return NextResponse.json({ ok: true });

    const resultado = await pagamento.consultarPagamento(idPagamento);
    if (!resultado) {
      // Não deu para confirmar. 500 faz o MP retentar, que é o que queremos —
      // melhor uma retentativa que uma venda paga sem entrega.
      return NextResponse.json({ erro: 'indisponível' }, { status: 500 });
    }

    // O que fazer com o resultado — status, idempotência, atualizar o pedido,
    // disparar a entrega — mora em webhook-pagamento.ts, testado à parte
    // (src/lib/webhook-pagamento.test.ts) sem precisar de servidor HTTP.
    //
    // O `await` aqui só espera a parte SÍNCRONA (checar status, achar o
    // pedido, gravar `pago`). A entrega em si (`resultado.entrega`, dentro da
    // função) roda em segundo plano sem `await` — ignorada de propósito, para
    // este handler responder rápido ao Mercado Pago em vez de segurar a
    // resposta pelo tempo que a geração levar.
    await processarNotificacaoDePagamento(resultado);

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[api/webhook] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}

/** Janela contra replay. 5 min absorve deriva de relógio da VPS. */
export const TOLERANCIA_SEGUNDOS = 300;

/**
 * Devolve uma resposta 401 se a assinatura não conferir; `null` se estiver ok.
 *
 * ── Por que a tolerância é conferida aqui e não pelo SDK ───────────────────
 *
 * O `toleranceSeconds` do `mercadopago` v3.2.1 **está quebrado para webhooks
 * reais**. Ele lê o `ts` do cabeçalho como milissegundos:
 *
 *     const tsMs = Number(ts);
 *     const driftSeconds = Math.abs(now() - tsMs) / 1000;
 *
 * mas o Mercado Pago envia `ts` em **segundos** (o exemplo da própria
 * documentação é `ts=1704908010`, dez dígitos). A conta dá uma deriva de
 * ~56 anos, e a validação recusa **toda** notificação legítima.
 *
 * O efeito seria o pior possível e silencioso: 401 em todo webhook, nenhum
 * pedido pago entregue, e nada no log dizendo que a causa é uma unidade de
 * tempo. Confirmado em teste com o segredo real em 30/07/2026.
 *
 * Então: o SDK continua fazendo o que faz bem — o HMAC — e a janela de replay
 * é conferida aqui, aceitando as duas unidades.
 */
function validarAssinatura(
  req: NextRequest,
  dataIdQuery: string | null
): NextResponse | null {
  const segredo = segredoDoWebhook();

  if (!segredo) {
    // Aceitável em dev; em produção é buraco aberto, por isso grita no log.
    console.warn('[webhook] segredo ausente para o modo atual: assinatura NÃO validada');
    return null;
  }

  const xSignature = req.headers.get('x-signature');

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId: req.headers.get('x-request-id'),
      dataId: dataIdQuery,
      secret: segredo,
      // `toleranceSeconds` de propósito ausente — ver o comentário acima.
    });
  } catch (erro) {
    if (erro instanceof InvalidWebhookSignatureError) {
      console.warn(
        `[webhook] assinatura inválida (${erro.reason}) req=${erro.requestId ?? '-'}`
      );
      return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
    }
    throw erro;
  }

  if (!dentroDaJanela(xSignature)) {
    console.warn('[webhook] timestamp fora da janela de replay');
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  return null;
}

/**
 * Confere se o `ts` do cabeçalho está dentro da janela de replay.
 *
 * Aceita segundos e milissegundos: o MP manda segundos hoje, mas nada garante
 * que não mude, e tratar 10 dígitos como milissegundos daria 1970.
 */
export function dentroDaJanela(
  xSignature: string | null,
  agora = Date.now()
): boolean {
  if (!xSignature) return false;

  const ts = xSignature
    .split(',')
    .map((parte) => parte.trim().split('='))
    .find(([chave]) => chave === 'ts')?.[1];

  if (!ts || !/^\d+$/.test(ts)) return false;

  const numero = Number(ts);
  // Menos de 1e11 só pode ser segundos: em milissegundos isso seria 1973.
  const ms = numero < 1e11 ? numero * 1000 : numero;

  return Math.abs(agora - ms) / 1000 <= TOLERANCIA_SEGUNDOS;
}
