import { NextRequest, NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta, garantirConta } from '@/lib/autenticacao';
import { abrirCobranca } from '@/nucleo/cobrancas';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Abre a cobrança de um plano e devolve para onde ir pagar.
 *
 * O `plano_id` chega do cliente, mas **o preço não** — ele é lido do banco em
 * `abrirCobranca`. É a mesma regra do funil: valor que passa pelo navegador é
 * valor editável.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`assinar:${ip}`)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') {
    return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 });
  }

  let corpo: { plano?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  if (!corpo.plano) {
    return NextResponse.json({ erro: 'plano não informado' }, { status: 400 });
  }

  // `garantirConta` em vez de exigir que exista: alguém pode ter sessão
  // válida de um fluxo antigo sem linha em `contas`, e mandar essa pessoa
  // pro login seria perder uma venda por detalhe interno.
  const conta = buscarConta(sessao.email) ?? garantirConta(sessao.email);

  const aberta = abrirCobranca({
    contaId: conta.id,
    email: sessao.email,
    planoId: corpo.plano,
  });

  if (!aberta) {
    return NextResponse.json({ erro: 'plano indisponível' }, { status: 400 });
  }

  return NextResponse.json({ redirect: `/assinar/${aberta.cobranca.id}` });
}
