import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido } from '@/lib/db';
import { garantirConta } from '@/lib/autenticacao';
import { abrirCobranca } from '@/nucleo/cobrancas';
import { ehPlanoDaOferta } from '@/nucleo/oferta';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Comprar direto da tela de oferta, **sem sessão**.
 *
 * ── Por que não passa por `/api/planos/assinar` ───────────────────────────
 *
 * Aquela rota exige sessão de conta, e aqui a pessoa não tem uma: ela acabou
 * de sair do ritual, e o e-mail que ela digitou nunca foi verificado. Criar
 * sessão a partir dele deixaria qualquer um digitar o endereço de outra
 * pessoa e entrar no Bruxário dela — foi por isso que o login automático foi
 * recusado quando esta tela nasceu.
 *
 * ── Quem prova quem é ─────────────────────────────────────────────────────
 *
 * O `pedidoId` da URL. Ele é opaco, foi criado nesta aba há segundos, e é a
 * mesma prova que a própria `/oferta/[id]` já aceita para mostrar o familiar.
 * O e-mail da cobrança sai **do pedido**, nunca do corpo da requisição — sem
 * isso, alguém poderia pagar um plano e mandar creditar noutra conta.
 *
 * E o pior caso de um `pedidoId` adivinhado é alguém *pagar* pelo acesso de
 * outra pessoa. Não é um ataque que valha defender contra.
 *
 * ── O preço não viaja ─────────────────────────────────────────────────────
 *
 * Só o id do plano vem do cliente; o valor é lido do banco em
 * `abrirCobranca`. Valor que passa pelo navegador é valor editável.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`oferta:${ip}`)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }
  if (!pedido.email) {
    return NextResponse.json({ erro: 'pedido sem e-mail' }, { status: 400 });
  }

  let corpo: { plano?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  if (!corpo.plano || !ehPlanoDaOferta(corpo.plano)) {
    return NextResponse.json({ erro: 'plano fora da oferta' }, { status: 400 });
  }

  const conta = garantirConta(pedido.email);

  const aberta = abrirCobranca({
    contaId: conta.id,
    email: pedido.email,
    planoId: corpo.plano,
    origem: 'oferta',
  });

  if (!aberta) {
    return NextResponse.json({ erro: 'plano indisponível' }, { status: 400 });
  }

  return NextResponse.json({ redirect: `/assinar/${aberta.cobranca.id}` });
}
