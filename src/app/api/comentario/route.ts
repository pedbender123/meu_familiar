import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { buscarPedido, salvarComentario } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * O comentário do comprador sobre a própria revelação.
 *
 * ── Só o dono escreve, e a prova é a sessão ───────────────────────────────
 *
 * Conhecer o id do pedido **não basta** — o link é compartilhável, então
 * qualquer um que o receba conheceria o id. O que autoriza é estar logado com
 * o e-mail do pedido. Sem isso, o mural viraria uma caixa aberta de texto
 * público na sua página de vendas.
 *
 * O comentário nasce com `aprovado = 0` e só vai para o mural depois que você
 * ler no painel.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`comentario:${ip}`)) {
    return NextResponse.json({ erro: 'Aguarde um instante.' }, { status: 429 });
  }

  const { pedidoId, texto } = (await req.json().catch(() => ({}))) ?? {};

  if (!pedidoId || typeof pedidoId !== 'string') {
    return NextResponse.json({ erro: 'pedido inválido' }, { status: 400 });
  }
  if (!texto || typeof texto !== 'string' || texto.trim().length < 4) {
    return NextResponse.json({ erro: 'Escreva um pouquinho mais.' }, { status: 400 });
  }

  const pedido = buscarPedido(pedidoId);
  if (!pedido || pedido.status !== 'entregue') {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  const sessao = await sessaoAtual();
  const ehADona =
    !!sessao &&
    sessao.tipo === 'conta' &&
    sessao.email.toLowerCase() === pedido.email.toLowerCase();

  if (!ehADona) {
    return NextResponse.json(
      { erro: 'Só quem recebeu esta revelação pode comentar nela.' },
      { status: 403 }
    );
  }

  salvarComentario(uuidv4(), pedidoId, texto.trim().slice(0, 400));
  return NextResponse.json({ ok: true });
}
