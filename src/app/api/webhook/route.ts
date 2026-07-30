import { NextRequest, NextResponse } from 'next/server';
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import {
  buscarPedido,
  buscarPedidoPorPagamentoId,
  atualizarPedido,
  registrarEvento,
} from '@/lib/db';
import { pagamento, statusLiberaAcesso } from '@/lib/pagamento';
import { processarPedido } from '@/lib/processar';

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

    if (!statusLiberaAcesso(resultado.status)) {
      registrarEvento(`pagamento_${resultado.status}`);
      return NextResponse.json({ ok: true });
    }

    // Casa por `pagamento_id` (gravado na criação) ou pela referência externa,
    // que é o nosso pedidoId — o segundo cobre a notificação que chega antes
    // de a resposta síncrona ter sido salva.
    const pedido =
      buscarPedidoPorPagamentoId(idPagamento) ??
      (resultado.referenciaExterna
        ? buscarPedido(resultado.referenciaExterna)
        : undefined);

    if (!pedido) {
      console.warn(`[webhook] pagamento ${idPagamento} sem pedido correspondente`);
      return NextResponse.json({ ok: true });
    }

    // Idempotência: o MP reenvia. Só a primeira transição dispara a geração.
    if (pedido.status !== 'aguardando_pagamento') {
      return NextResponse.json({ ok: true });
    }

    atualizarPedido(pedido.id, { status: 'pago', pagamento_id: idPagamento });
    registrarEvento('pagamento_confirmado', pedido.id);
    processarPedido(pedido.id);

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[api/webhook] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}

/** Devolve uma resposta 401 se a assinatura não conferir; `null` se estiver ok. */
function validarAssinatura(
  req: NextRequest,
  dataIdQuery: string | null
): NextResponse | null {
  const segredo = process.env.MP_WEBHOOK_SECRET;

  if (!segredo) {
    // Aceitável em dev; em produção é buraco aberto, por isso grita no log.
    console.warn('[webhook] MP_WEBHOOK_SECRET ausente: assinatura NÃO validada');
    return null;
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: dataIdQuery,
      secret: segredo,
      // Janela contra replay. 5 min absorve deriva de relógio da VPS.
      toleranceSeconds: 300,
    });
    return null;
  } catch (erro) {
    if (erro instanceof InvalidWebhookSignatureError) {
      console.warn(
        `[webhook] assinatura inválida (${erro.reason}) req=${erro.requestId ?? '-'}`
      );
      return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
    }
    throw erro;
  }
}
