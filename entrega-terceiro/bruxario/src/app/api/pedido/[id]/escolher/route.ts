import { NextRequest, NextResponse } from 'next/server';
import { atualizarPedido, buscarPedido, registrarEvento } from '@/lib/db';
import { calcularExpiracao, ehProdutoValido, produtoDe } from '@/lib/produtos';
import { precoComDesconto } from '@/lib/preco';
import { aposPagamento } from '@/lib/processar';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * A escolha do plano, feita na tela de revelação parcial.
 *
 * ── Por que uma rota e não um parâmetro na URL do pagamento ───────────────
 *
 * Isto **escreve** no pedido: troca o produto e carimba a condição de
 * lançamento. Fazer isso durante o render de uma página seria mutação num GET
 * — e um GET que muda estado é acionado por pré-carregamento do navegador, por
 * robô de rede social e por qualquer um que passe o mouse no link.
 *
 * ── A condição de lançamento é aplicada AQUI ──────────────────────────────
 *
 * Não no ritual, porque o ritual não escolhe mais plano. O percentual sai do
 * cupom real no banco: desligar o cupom no painel desliga a condição em todo
 * lugar, e nenhum número vive escrito à mão no meio do caminho.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`escolher:${ip}`)) {
    return NextResponse.json({ erro: 'Aguarde um instante.' }, { status: 429 });
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  // Já adiantado: manda para onde a pessoa deveria estar em vez de reabrir
  // uma escolha que não existe mais.
  if (pedido.status === 'entregue') {
    return NextResponse.json({ redirect: `/revelacao/${id}` });
  }
  if (pedido.status !== 'aguardando_pagamento') {
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }

  const corpo = (await req.json().catch(() => ({}))) ?? {};
  if (!ehProdutoValido(corpo.produto) || produtoDe(corpo.produto).tipo !== 'principal') {
    return NextResponse.json({ erro: 'produto inválido' }, { status: 400 });
  }

  /**
   * O preço vem do MODELO VIGENTE, não da tabela estática.
   *
   * `produtos.ts` já tem a Revelação zerada (modelo novo). Enquanto o
   * interruptor estiver desligado, ela precisa custar o que a campanha está
   * vendendo — senão o funil entrega de graça o que o anúncio cobra.
   */
  const produto = produtoDe(corpo.produto);

  const desconto = 0;
  const preco = precoComDesconto(produto, desconto);

  atualizarPedido(id, {
    produto: produto.id,
    desconto_percentual: null,
  });

  /**
   * Preço zero não passa pelo gateway.
   *
   * Se a condição de lançamento chegar a 100% algum dia, mandar R$ 0,00 ao
   * Mercado Pago não é "grátis" — é um pagamento que ele recusa, e a pessoa
   * veria erro no lugar do produto.
   */
  if (preco.gratis) {
    const pagoEm = new Date();
    atualizarPedido(id, {
      status: 'pago',
      pago_em: pagoEm.toISOString(),
      expira_em: calcularExpiracao(produto, pagoEm),
    });
    registrarEvento('pagamento_dispensado_por_cupom', id);
    aposPagamento(id);
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }

  return NextResponse.json({ redirect: `/pagamento/${id}` });
}
