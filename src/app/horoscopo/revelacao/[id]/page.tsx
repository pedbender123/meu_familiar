import { buscarPedidoHoroscopo, atualizarPedidoHoroscopo } from '@/lib/horoscopo/db';
import { gerarHoroscopo, type LeituraHoroscopo } from '@/lib/horoscopo/leitura';
import { MarcaCompraHoroscopo } from '@/components/horoscopo/MarcaCompraHoroscopo';
import type { Signo } from '@/lib/astro';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RevelacaoHoroscopo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedidoHoroscopo(id);

  if (!pedido || pedido.status === 'aguardando_pagamento') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center gap-4 bg-tinta text-pergaminho">
        <h1 className="font-display italic text-2xl">Este horóscopo ainda não chegou.</h1>
        <Link href="/horoscopo" className="font-corpo text-sm text-violeta underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  let leitura: LeituraHoroscopo;
  if (pedido.leitura_json) {
    leitura = JSON.parse(pedido.leitura_json);
  } else {
    // Pago, mas a geração no webhook falhou (rede, Gemini fora do ar). Gera
    // aqui, na hora que a pessoa efetivamente chega na tela — não pode ficar
    // pago sem entrega esperando um retry que nunca vem.
    leitura = await gerarHoroscopo(
      pedido.nome,
      pedido.signo_sol as Signo,
      pedido.signo_lua as Signo
    );
    atualizarPedidoHoroscopo(id, { status: 'entregue', leitura_json: JSON.stringify(leitura) });
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-5 py-16 gap-8 bg-tinta text-pergaminho">
      <MarcaCompraHoroscopo pedidoId={id} />

      <div className="w-full max-w-lg flex flex-col items-center gap-8 text-center">
        <span className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          Sol em {pedido.signo_sol} · Lua em {pedido.signo_lua}
        </span>

        <h1 className="font-display italic text-3xl sm:text-4xl leading-tight text-balance">
          {leitura.titulo}
        </h1>

        <div className="flex flex-col gap-5 max-w-[62ch] text-left leading-[1.75]">
          {leitura.paragrafos.map((paragrafo, i) => (
            <p key={i} className="font-corpo font-light text-pergaminho/85">
              {paragrafo}
            </p>
          ))}
        </div>

        <p className="font-display italic text-xl sm:text-2xl leading-snug text-ouro-profundo max-w-[30ch]">
          {leitura.frase_final}
        </p>
      </div>
    </main>
  );
}
