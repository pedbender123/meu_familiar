'use client';

import Link from 'next/link';
import { useState } from 'react';

export interface PlanoDaOferta {
  id: string;
  nome: string;
  precoCentavos: number;
  beneficios: string[];
  destaque: boolean;
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * A oferta, e a porta de saída ao lado dela.
 *
 * ── A ordem na tela é a decisão inteira ───────────────────────────────────
 *
 * A oferta vem primeiro porque este é o único momento de atenção total da
 * pessoa. Mas o botão de ver o familiar é **grande, claro e primário** — não
 * um link cinza no rodapé.
 *
 * O truque de esconder a saída funciona uma vez e custa a confiança de
 * sempre: quem se sente empurrado num produto de assinatura cancela no
 * primeiro mês, e conta pra alguém. A landing prometeu que o ritual é de
 * graça; a tela imediatamente seguinte é onde essa promessa é testada.
 */
export function OfertaDepoisDoRitual({
  pedidoId,
  planos,
}: {
  pedidoId: string;
  planos: PlanoDaOferta[];
}) {
  const [indo, setIndo] = useState<string | null>(null);

  return (
    <div className="w-full flex flex-col items-center gap-8">
      {/* ── O que abre com plano ───────────────────────────────────────── */}
      <section className="w-full flex flex-col gap-5">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
            e tem mais esperando
          </p>
          <h2 className="font-display italic text-xl sm:text-2xl text-pergaminho text-balance max-w-[26ch] leading-tight">
            O seu familiar sabe mais do que cabe numa leitura.
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {planos.map((plano) => (
            <div
              key={plano.id}
              className="flex flex-col gap-4 p-5 rounded-2xl border"
              style={{
                borderColor: plano.destaque
                  ? 'rgba(217,164,65,0.45)'
                  : 'rgba(234,224,204,0.14)',
                background: plano.destaque
                  ? 'linear-gradient(165deg, rgba(217,164,65,0.1), rgba(234,224,204,0.02))'
                  : 'rgba(234,224,204,0.03)',
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display italic text-lg text-pergaminho">
                  {plano.nome}
                </h3>
                <span className="font-display text-xl text-vela shrink-0">
                  {reais(plano.precoCentavos)}
                  <span className="font-corpo text-[0.6rem] text-pergaminho/40">/mês</span>
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {plano.beneficios.map((b) => (
                  <li
                    key={b}
                    className="font-corpo font-light text-[0.8rem] text-pergaminho/70 leading-snug"
                  >
                    {b}
                  </li>
                ))}
              </ul>

              <Link
                href="/planos"
                onClick={() => setIndo(plano.id)}
                className={[
                  'mt-auto text-center font-corpo text-sm px-5 py-2.5 rounded-full transition-all',
                  plano.destaque
                    ? 'bg-vela text-tinta font-medium hover:brightness-110'
                    : 'border border-vela/50 text-vela hover:bg-vela/10',
                ].join(' ')}
              >
                {indo === plano.id ? 'Abrindo...' : 'Quero este'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── A saída, do mesmo tamanho ──────────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-3 pt-2 border-t border-pergaminho/10">
        <Link
          href={`/revelacao/${pedidoId}`}
          className="mt-5 font-corpo text-base px-8 py-3.5 rounded-full border border-pergaminho/30 text-pergaminho hover:border-pergaminho/60 hover:bg-pergaminho/[0.04] transition-all"
        >
          Ver o meu familiar agora
        </Link>
        <p className="font-corpo text-xs text-pergaminho/40 text-center max-w-[36ch] leading-relaxed">
          É de graça e continua sendo. Dá para assinar depois, de dentro do seu
          Bruxário.
        </p>
      </div>
    </div>
  );
}
