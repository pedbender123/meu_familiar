import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, buscarPedidoPorPaymentId, atualizarPedido, registrarEvento } from '@/lib/db';
import { processarPedido } from '@/lib/processar';

const EVENTOS_PAGO = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);

export async function POST(req: NextRequest) {
  const token = req.headers.get('asaas-access-token');
  if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  try {
    const corpo = await req.json();
    const evento = corpo?.event;
    const pagamento = corpo?.payment;

    if (!EVENTOS_PAGO.has(evento) || !pagamento) {
      return NextResponse.json({ ok: true });
    }

    // O pedido foi criado com um Checkout hospedado (/v3/checkouts), não com
    // um /payments avulso — então o "payment.id" do webhook é o ID do
    // pagamento que a Asaas gerou por baixo dos panos, DIFERENTE do
    // checkout.id que guardamos. O campo que bate com o que guardamos é
    // payment.checkoutSession. externalReference (que setamos na criação do
    // checkout = nosso pedidoId) é o mais direto quando presente.
    const pedido =
      (pagamento.externalReference && buscarPedido(pagamento.externalReference)) ||
      (pagamento.checkoutSession && buscarPedidoPorPaymentId(pagamento.checkoutSession)) ||
      buscarPedidoPorPaymentId(pagamento.id);

    if (!pedido || pedido.status !== 'aguardando_pagamento') {
      // idempotente: já processado ou pedido desconhecido
      return NextResponse.json({ ok: true });
    }

    atualizarPedido(pedido.id, { status: 'pago', asaas_payment_id: pagamento.id });
    registrarEvento('pagamento_confirmado', pedido.id);
    processarPedido(pedido.id);

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[api/webhook] erro:', erro);
    // nunca deixar exceção virar 500 — o Asaas pausa a fila de webhooks
    return NextResponse.json({ ok: true });
  }
}
