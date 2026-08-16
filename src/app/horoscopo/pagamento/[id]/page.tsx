import { notFound, redirect } from 'next/navigation';
import { buscarPedidoHoroscopo } from '@/lib/horoscopo/db';
import {
  chavePublicaHoroscopo,
  modoAtualHoroscopo,
  pagamentoHoroscopoEhFake,
  PRECO_HOROSCOPO_CENTAVOS,
} from '@/lib/horoscopo/pagamento';
import { CheckoutHoroscopo } from '@/components/horoscopo/CheckoutHoroscopo';
import { PagamentoFakeHoroscopo } from '@/components/horoscopo/PagamentoFakeHoroscopo';

export default async function PagamentoHoroscopo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedidoHoroscopo(id);
  if (!pedido) notFound();
  if (pedido.status !== 'aguardando_pagamento') redirect(`/horoscopo/revelacao/${id}`);

  const chave = chavePublicaHoroscopo();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-tinta text-pergaminho">
      {pagamentoHoroscopoEhFake() || !chave ? (
        <PagamentoFakeHoroscopo pedidoId={id} />
      ) : (
        <CheckoutHoroscopo
          pedidoId={id}
          chavePublica={chave}
          valorEmReais={PRECO_HOROSCOPO_CENTAVOS / 100}
          nomeProduto="Horóscopo Pessoal"
          modo={modoAtualHoroscopo()}
        />
      )}
    </main>
  );
}
