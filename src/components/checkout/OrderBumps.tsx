'use client';

import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

/**
 * A estante no checkout.
 *
 * ── Por que capa, e não lista ─────────────────────────────────────────────
 *
 * A primeira versão era uma lista de caixinhas com título e preço. Ela
 * funcionava e era feia — e num produto que vende ritual, feio não é só
 * questão de gosto: a lista dizia "isto aqui é um adicional de e-commerce",
 * quando o que está sendo vendido é um livro.
 *
 * Capa muda a natureza da coisa oferecida. Um retângulo com texto é um item;
 * uma capa com lombada é um objeto que se pega. E o objeto tinha sido
 * desenhado e estava sem uso, o que é a pior forma de desperdício.
 *
 * ── Os detalhes que não têm função ────────────────────────────────────────
 *
 * A lombada mais escura na borda esquerda, o livro que sobe dois pixels ao
 * passar o mouse, o brilho que atravessa a capa quando ela é marcada, o selo
 * que gira ao entrar. Nada disso serve para nada.
 *
 * É de propósito. Detalhe gratuito é o que separa produto feito com cuidado
 * de produto montado — e as pessoas reparam nele muito mais do que na
 * funcionalidade, porque a funcionalidade elas esperam e o detalhe não.
 *
 * ── A sinopse abre por cima, e uma de cada vez ────────────────────────────
 *
 * Empurrar as outras capas para baixo faria a grade saltar no clique, e
 * salto no meio de um checkout é a coisa mais fácil de fazer alguém desistir.
 * Ela abre sobreposta, fecha ao tocar fora, e nunca há duas abertas.
 */

export interface EbookDoCheckout {
  id: string;
  titulo: string;
  promessa: string;
  sinopse: string;
  capitulos: number;
  precoCentavos: number;
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function OrderBumps({
  ebooks,
  marcados,
  aoMarcar,
}: {
  ebooks: EbookDoCheckout[];
  marcados: string[];
  /** Recebe o id alternado — quem guarda a lista é o checkout. */
  aoMarcar: (id: string) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);

  if (ebooks.length === 0) return null;

  const emAberto = ebooks.find((e) => e.id === aberto);

  return (
    <section className="relative flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-corpo text-[0.68rem] tracking-[0.18em] uppercase text-pergaminho/45">
          Leve junto
        </h2>
        <span className="font-corpo font-light text-[0.66rem] text-pergaminho/30">
          toque na capa para ver
        </span>
      </div>

      {/*
        Três colunas fixas, inclusive no celular.

        Uma estante com scroll horizontal esconde o terceiro livro, e livro
        escondido não é comprado. Em 320px a capa fica com 88px de largura —
        pequena, e ainda assim reconhecível como capa, que é o que importa.
      */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {ebooks.map((e, i) => {
          const marcado = marcados.includes(e.id);
          return (
            <div key={e.id} className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setAberto(aberto === e.id ? null : e.id)}
                aria-expanded={aberto === e.id}
                className="group relative block w-full"
                style={{
                  // A entrada escalonada: cada livro chega 90ms depois do
                  // anterior, como quem põe três volumes na prateleira.
                  animation: `livroChega 620ms cubic-bezier(.2,.8,.2,1) ${i * 90}ms both`,
                }}
              >
                <span
                  className="relative block w-full aspect-[3/4] rounded-[3px] overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-[3px]"
                  style={{
                    boxShadow: marcado
                      ? '0 10px 22px -8px rgba(0,0,0,0.8), 0 0 0 1.5px var(--vela), 0 0 26px -6px rgba(217,164,65,0.5)'
                      : '0 6px 16px -8px rgba(0,0,0,0.75), 0 0 0 1px rgba(234,224,204,0.10)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/biblioteca/capa/${e.id}`}
                    alt={e.titulo}
                    className="w-full h-full object-cover transition duration-500"
                    style={{
                      filter: marcado ? 'none' : 'saturate(0.82) brightness(0.82)',
                    }}
                  />

                  {/*
                    A lombada: uma faixa escura na borda esquerda com um fio
                    de luz. É o que faz o retângulo virar livro em vez de
                    cartão — e custa duas linhas de gradiente.
                  */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-[9px]"
                    style={{
                      background:
                        'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 45%, rgba(255,255,255,0.10) 72%, transparent 100%)',
                    }}
                  />

                  {/* O brilho que atravessa a capa no instante em que ela é marcada. */}
                  {marcado && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(105deg, transparent 35%, rgba(255,236,190,0.42) 50%, transparent 65%)',
                        animation: 'brilhoDaCapa 900ms ease-out 1',
                      }}
                    />
                  )}

                  {/* O selo de marcado, que gira ao entrar. */}
                  {marcado && (
                    <span
                      className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full flex items-center justify-center"
                      style={{
                        background: 'var(--vela)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        animation: 'seloGira 380ms cubic-bezier(.2,1.4,.4,1) both',
                      }}
                    >
                      <Check size={13} strokeWidth={3} className="text-tinta" />
                    </span>
                  )}
                </span>
              </button>

              {/*
                O botão de marcar é separado da capa.

                Tocar na capa abre a sinopse; marcar é outro gesto, com outro
                alvo. Juntar os dois faria quem só queria olhar comprar sem
                querer — e compra sem querer volta como estorno.
              */}
              <button
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => aoMarcar(e.id)}
                className="w-full rounded-lg border px-2 py-1.5 flex items-center justify-center gap-1.5 transition"
                style={{
                  borderColor: marcado
                    ? 'rgba(217,164,65,0.55)'
                    : 'color-mix(in srgb, var(--pergaminho) 16%, transparent)',
                  background: marcado ? 'rgba(217,164,65,0.12)' : 'transparent',
                  color: marcado ? 'var(--vela)' : 'color-mix(in srgb, var(--pergaminho) 62%, transparent)',
                }}
              >
                {marcado ? (
                  <Check size={12} strokeWidth={2.5} />
                ) : (
                  <Plus size={12} strokeWidth={2} />
                )}
                <span className="font-corpo text-[0.7rem] tabular-nums">
                  {reais(e.precoCentavos)}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <p className="font-corpo font-light text-[0.68rem] leading-snug text-pergaminho/35 px-1">
        Fica na sua biblioteca para sempre, mesmo sem assinatura.
      </p>

      {/* ── a sinopse, por cima ── */}
      {emAberto && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(12,10,16,0.72)', animation: 'veuEntra 220ms ease-out both' }}
            onClick={() => setAberto(null)}
          />
          <div
            className="fixed z-50 inset-x-5 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] rounded-2xl border p-5 flex flex-col gap-4"
            style={{
              borderColor: 'rgba(217,164,65,0.28)',
              background: 'var(--tinta)',
              boxShadow: '0 30px 70px -20px rgba(0,0,0,0.85)',
              animation: 'sinopseAbre 300ms cubic-bezier(.2,.9,.3,1) both',
            }}
          >
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/biblioteca/capa/${emAberto.id}`}
                alt=""
                className="w-[76px] shrink-0 aspect-[3/4] object-cover rounded-[3px]"
                style={{ boxShadow: '0 6px 18px -6px rgba(0,0,0,0.8)' }}
              />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <h3 className="font-display italic text-[1.05rem] leading-snug text-pergaminho">
                  {emAberto.titulo}
                </h3>
                <p className="font-corpo text-[0.7rem] text-pergaminho/40 tabular-nums">
                  {emAberto.capitulos} capítulos · leitura no app
                </p>
              </div>
              <button
                onClick={() => setAberto(null)}
                aria-label="Fechar"
                className="shrink-0 text-pergaminho/40 hover:text-vela transition"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <p className="font-corpo font-light text-[0.82rem] leading-relaxed text-pergaminho/65">
              {emAberto.sinopse}
            </p>

            <button
              onClick={() => {
                aoMarcar(emAberto.id);
                setAberto(null);
              }}
              className="w-full rounded-full py-2.5 font-corpo text-[0.82rem] transition"
              style={
                marcados.includes(emAberto.id)
                  ? {
                      border: '1px solid color-mix(in srgb, var(--pergaminho) 20%, transparent)',
                      color: 'color-mix(in srgb, var(--pergaminho) 60%, transparent)',
                    }
                  : { background: 'var(--vela)', color: 'var(--tinta)', fontWeight: 500 }
              }
            >
              {marcados.includes(emAberto.id)
                ? 'Tirar do pedido'
                : `Somar ${reais(emAberto.precoCentavos)} ao pedido`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
