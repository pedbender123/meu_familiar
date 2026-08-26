import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { chavePublica, modoAtual, pagamentoEhFake } from '@/nucleo/checkouts/mercadopago';
import { Checkout } from '@/components/checkout/Checkout';
import { gatewayConferido } from '@/nucleo/checkouts/gateway';
import { PagamentoFake } from '@/components/PagamentoFake';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { PRECO_DA_MELHORIA_CENTAVOS, podeMelhorar } from '@/nucleo/melhoria';

export const metadata = {
  title: 'Sua leitura completa · Bruxário',
  robots: { index: false, follow: false },
};

/**
 * A oferta de melhoria — vendida DEPOIS da entrega.
 *
 * ── Por que esta tela existe separada do checkout normal ──────────────────
 *
 * `/pagamento/[id]` redireciona todo pedido que não esteja em
 * `aguardando_pagamento`, e o dono desta leitura já recebeu a dela. Forçar o
 * pedido de volta àquele estado tiraria dela o acesso ao que já é seu
 * enquanto o pagamento não confirmasse.
 *
 * ── E por que ela converte ────────────────────────────────────────────────
 *
 * Quem chega aqui já leu o que comprou. A pergunta deixou de ser "vale a
 * pena?" e virou "quero mais disso?" — que é a venda mais fácil que existe, e
 * a única que só pode acontecer depois.
 */
export default async function Melhorar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  // Já melhorada, ou já era a Completa: não há o que oferecer.
  if (pedido.melhoria_paga_em || pedido.produto === 'completa') {
    redirect(`/revelacao/${id}`);
  }
  if (!podeMelhorar(pedido)) redirect(`/revelacao/${id}`);

  const familiar = FAMILIARES[pedido.familiar as FamiliarId];
  const chave = chavePublica();
  const valorEmReais = PRECO_DA_MELHORIA_CENTAVOS / 100;

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center px-5 py-12 gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          {familiar && (
            <SigiloFamiliar sigilo={familiar.sigilo} tamanho={96} variante="quarto" />
          )}
          <h1 className="font-display italic text-3xl sm:text-4xl text-pergaminho leading-tight text-balance max-w-[22ch]">
            {familiar ? `${familiar.nome} não terminou de falar.` : 'Ele não terminou de falar.'}
          </h1>
          <p className="font-corpo font-light text-sm text-pergaminho/60 max-w-[40ch] leading-relaxed">
            O que você leu foi a parte curta. A leitura completa tem o dobro do
            texto, os gráficos do que o teste mediu em você, e a voz dele
            narrando tudo.
          </p>
        </header>

        <ul className="flex flex-col gap-2 w-full max-w-sm">
          {[
            'O relatório longo, com os quatro eixos do seu perfil',
            'Os gráficos do que as 26 cenas mediram',
            'A leitura narrada em áudio, na voz dele',
            'Um novo PDF, com tudo isso dentro',
          ].map((linha) => (
            <li
              key={linha}
              className="font-corpo font-light text-sm text-pergaminho/75 leading-snug flex gap-2.5"
            >
              <span aria-hidden="true" className="text-vela/70">
                ·
              </span>
              {linha}
            </li>
          ))}
        </ul>

        {pagamentoEhFake() || !chave ? (
          <PagamentoFake pedidoId={id} base="pedido" />
        ) : (
          <Checkout
            base="pedido"
            caminho="melhorar"
            destino={`/revelacao/${id}`}
            pedidoId={id}
            chavePublica={chave}
            valorEmReais={valorEmReais}
            nomeProduto="Revelação Completa"
            itens={[
              'Relatório longo do seu perfil',
              'Gráficos dos quatro eixos',
              'Narração em áudio',
            ]}
            modo={modoAtual()}
            nome={pedido.nome}
            cpf={pedido.cpf}
            gatewayPix={await gatewayConferido('pix', pedido.campanha_id)}
            gatewayCartao={await gatewayConferido('cartao', pedido.campanha_id)}
          />
        )}
      </main>
    </>
  );
}
