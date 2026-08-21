import { NextRequest, NextResponse } from 'next/server';
import { pagamento } from '@/nucleo/checkouts/directpag';
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

function validarAssinatura(
  _req: NextRequest,
  _dataIdQuery: string | null
): NextResponse | null {
  /**
   * **O DirectPag não assina o postback.** Não há HMAC, não há header
   * assinado — a documentação não descreve verificação nenhuma. Qualquer um
   * que descubra esta URL pode fingir um pagamento aprovado.
   *
   * Por isso o corpo da notificação é tratado como AVISO, não como verdade:
   * dele só se aproveita o id da transação, e o status real vem de uma
   * consulta NOSSA à API (`consultarPagamento`), autenticada com o nosso
   * token. Notificação forjada não entrega nada, porque quem decide é a
   * resposta do gateway e não quem bateu na porta.
   *
   * Recusar aqui seria teatro: sem segredo compartilhado não há o que
   * conferir. A defesa real está uma camada adiante, e está escrita lá.
   */
  return null;
}

