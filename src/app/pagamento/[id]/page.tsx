import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { chavePublica, pagamentoEhFake } from '@/lib/pagamento';
import { precoEmReais, produtoDe } from '@/lib/produtos';
import { CheckoutMercadoPago } from '@/components/CheckoutMercadoPago';
import { PagamentoFake } from '@/components/PagamentoFake';

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
  const chave = chavePublica();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      {pagamentoEhFake() || !chave ? (
        <PagamentoFake pedidoId={id} />
      ) : (
        <CheckoutMercadoPago
          pedidoId={id}
          chavePublica={chave}
          valorEmReais={precoEmReais(produto)}
          nomeProduto={produto.nome}
        />
      )}
    </main>
  );
}
