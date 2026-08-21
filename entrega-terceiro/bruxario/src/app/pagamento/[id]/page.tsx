import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { pagamentoEhFake } from '@/nucleo/checkouts/directpag';
import { produtoDe } from '@/lib/produtos';
import { precoDoPedido } from '@/lib/cupons';
import { CheckoutDirectPag } from '@/components/CheckoutDirectPag';
import { PagamentoFake } from '@/components/PagamentoFake';
import { MarcoDoCheckout } from '@/components/MarcoDoCheckout';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';

/**
 * Server component de propósito: o preço é lido do produto no servidor, não
 * calculado no navegador. A versão anterior tinha `const PRECO = 980/100`
 * hardcoded no cliente, o que significava que mudar de produto exigia mudar
 * código de UI.
 */
export default async function Pagamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  // Pedido já adiantado: não faz sentido mostrar checkout.
  if (pedido.status === 'entregue') redirect(`/revelacao/${id}`);
  if (pedido.status !== 'aguardando_pagamento') redirect(`/obrigado/${id}`);

  const produto = produtoDe(pedido.produto);
  // O valor exibido sai da MESMA função que monta a cobrança no Mercado Pago,
  // lendo o cupom gravado no pedido. Não existe caminho em que a tela mostre
  // um preço e o cartão seja debitado por outro.
  const preco = precoDoPedido(pedido);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <MarcoDoCheckout pedidoId={id} valorEmReais={preco.finalCentavos / 100} />
      {pagamentoEhFake() ? (
        <PagamentoFake pedidoId={id} />
      ) : (
        <CheckoutDirectPag
          pedidoId={id}
          destino={`/obrigado/${id}`}
          valorEmReais={preco.finalCentavos / 100}
          nomeProduto={produto.nome}
          emailDoPedido={pedido.email ?? undefined}
          nomeDoPedido={pedido.nome ?? undefined}
        />
      )}
    </main>
  );
}

/**
 * O resumo do que está sendo comprado, para a tela de pagamento.
 *
 * Curto de propósito — três linhas. Aqui não é lugar de vender de novo, é
 * lugar de confirmar que a pessoa está comprando o que ela acha que está.
 */
