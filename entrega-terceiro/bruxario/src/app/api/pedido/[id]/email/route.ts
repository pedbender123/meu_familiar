import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import { validarEmail } from '@/lib/validacao';
import { aposPagamento } from '@/lib/processar';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Recebe o endereço de quem comprou sem deixar e-mail no funil.
 *
 * ── Por que este endpoint existe ──────────────────────────────────────────
 *
 * O funil de anúncio deixa a pessoa pagar com dois campos preenchidos: nome e
 * nascimento. Encurtar o caminho até o preço custa o endereço de entrega, e é
 * aqui que ele é recuperado — depois do pagamento, onde "para onde eu mando?"
 * é uma pergunta óbvia em vez de um pedágio.
 *
 * ── Só preenche o que está vazio ──────────────────────────────────────────
 *
 * O id do pedido viaja na URL. Se este endpoint pudesse SUBSTITUIR um e-mail
 * já gravado, quem tivesse o link redirecionaria a revelação de outra pessoa
 * para o próprio endereço — e a conta junto, porque `garantirConta` roda sobre
 * este campo. Por isso: preenche uma vez, e só uma.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`email:${ip}`)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 });
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }
  if (pedido.email) {
    return NextResponse.json({ erro: 'este pedido já tem endereço' }, { status: 409 });
  }

  const corpo = await req.json().catch(() => ({}));
  const email = typeof corpo?.email === 'string' ? corpo.email.trim() : '';
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'Confira o e-mail.' }, { status: 400 });
  }

  atualizarPedido(id, { email });
  registrarEvento('email_coletado_apos_pagamento', id);

  /**
   * A entrega foi PULADA quando o pagamento confirmou (não havia para onde
   * mandar). Agora que há, ela é retomada daqui — sem isso o pedido ficaria
   * pago e parado para sempre.
   *
   * `aposPagamento` decide sozinho o que fazer: manda a confirmação e espera o
   * ritual, ou gera tudo se as 26 cenas já foram respondidas. Roda solto de
   * propósito — a resposta não espera a IA.
   */
  if (pedido.status === 'pago' || pedido.status === 'erro') {
    void aposPagamento(id).catch((erro) => {
      console.error(`[api/pedido/email] entrega falhou no ${id}:`, erro);
    });
  }

  return NextResponse.json({ ok: true });
}
