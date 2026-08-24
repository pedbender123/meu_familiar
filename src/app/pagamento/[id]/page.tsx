import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { chavePublica, modoAtual, pagamentoEhFake } from '@/nucleo/checkouts/mercadopago';
import { produtoDe } from '@/lib/produtos';
import { precoDoPedido } from '@/lib/cupons';
import { CheckoutMercadoPago } from '@/components/CheckoutMercadoPago';
import { CheckoutCaktoPix } from '@/components/CheckoutCaktoPix';
import { gatewayDe } from '@/nucleo/checkouts/gateway';
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
  const chave = chavePublica();

  /**
   * Quem cobra cada meio, decidido no servidor a cada visita.
   *
   * Durante a virada os dois convivem: o Pix pode estar na Cakto e o cartão no
   * Mercado Pago. Quando o Pix não é do Brick, ele sai do Brick — deixar os
   * dois oferecendo Pix mostraria duas formas de fazer a mesma coisa, com
   * gateways diferentes, na mesma tela.
   */
  const pixNaCakto = gatewayDe('pix') === 'cakto';

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <MarcoDoCheckout pedidoId={id} valorEmReais={preco.finalCentavos / 100} />
      {pagamentoEhFake() || !chave ? (
        <PagamentoFake pedidoId={id} />
      ) : (
        <>
        {pixNaCakto ? (
          <div className="w-full max-w-md mb-10">
            <CheckoutCaktoPix
              pedidoId={id}
              valorEmReais={preco.finalCentavos / 100}
              nome={pedido.nome}
              cpf={pedido.cpf}
            />
          </div>
        ) : null}
        <CheckoutMercadoPago
          pedidoId={id}
          chavePublica={chave}
          valorEmReais={preco.finalCentavos / 100}
          nomeProduto={produto.nome}
          generoDoFamiliar={FAMILIARES[pedido.familiar as FamiliarId]?.genero}
          itens={itensDoProduto(produto.id)}
          cupom={
            pedido.cupom
              ? { codigo: pedido.cupom, descontoPercentual: preco.descontoPercentual, cheioEmReais: preco.cheioCentavos / 100 }
              : undefined
          }
          modo={modoAtual()}
          pixNoBrick={!pixNaCakto}
        />
        </>
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
function itensDoProduto(id: string): string[] {
  if (id === 'completa') {
    return [
      'Quem é o seu familiar, com o retrato e o nome secreto',
      'A leitura longa, escrita a partir das suas 26 respostas',
      'A narração em áudio, os gráficos do seu perfil e o link permanente',
    ];
  }
  return [
    'Quem é o seu familiar, com o retrato e o nome secreto',
    'A leitura escrita a partir das suas 26 respostas',
    'PDF e as artes no seu e-mail, na hora',
  ];
}
