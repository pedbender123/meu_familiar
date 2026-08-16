import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido } from '@/lib/db';
import { registrarMarcacao } from '@/lib/marcacoes';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';

/**
 * Registra o @ de quem compartilhou nos stories.
 *
 * Exige **sessão e propriedade do pedido**: sem isso, qualquer pessoa com o
 * link público de uma revelação registraria um @ em nome de quem comprou, e a
 * fila de conferência viraria lixo.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`marcacao:${ip}`, LIMITES.analitica)) {
    return NextResponse.json({ ok: false, erro: 'Aguarde um instante.' }, { status: 429 });
  }

  const sessao = await sessaoAtual();
  if (!sessao) {
    return NextResponse.json(
      { ok: false, erro: 'Entre na sua conta para registrar.' },
      { status: 401 }
    );
  }

  const { pedidoId, arroba } = (await req.json().catch(() => ({}))) ?? {};
  const pedido = typeof pedidoId === 'string' ? buscarPedido(pedidoId) : undefined;

  if (!pedido || pedido.status !== 'entregue') {
    return NextResponse.json({ ok: false, erro: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (
    sessao.tipo !== 'admin' &&
    sessao.email.toLowerCase() !== pedido.email.toLowerCase()
  ) {
    return NextResponse.json({ ok: false, erro: 'Não é o seu pedido.' }, { status: 403 });
  }

  const resultado = registrarMarcacao({
    pedidoId: pedido.id,
    email: pedido.email,
    arroba: String(arroba ?? ''),
  });

  return NextResponse.json(resultado);
}
