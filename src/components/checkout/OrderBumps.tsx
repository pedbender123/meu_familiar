'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';

/**
 * A estante no checkout.
 *
 * ── Por que isto deixou de ser uma prateleira ─────────────────────────────
 *
 * A versão anterior era bonita e vendia mal, e foi o time de marketing que
 * apontou por quê — mandaram o print de um checkout comum, do tipo que
 * qualquer pessoa já viu dez vezes, e pediram "essa estrutura aí".
 *
 * A prateleira mostrava três capas de 88px lado a lado. Para saber o que era
 * cada livro, a pessoa tinha que TOCAR na capa e ler uma sinopse que abria
 * por cima. Ou seja: no meio de um pagamento, o argumento de venda dos três
 * livros estava atrás de um gesto que quase ninguém faz. Quem não tocava via
 * três miniaturas ilegíveis e um preço solto — e três miniaturas ilegíveis
 * não são uma oferta, são um obstáculo entre a pessoa e o botão de pagar.
 *
 * Agora é uma linha por livro, empilhada, com tudo visível sem gesto nenhum:
 * capa pequena, título, a promessa de uma linha, o preço com âncora e o botão
 * de somar. É o formato mais batido que existe em checkout brasileiro, e essa
 * é a vantagem dele: a pessoa reconhece o padrão e sabe o que fazer sem
 * aprender nada.
 *
 * ── O que foi preservado da versão bonita ─────────────────────────────────
 *
 * A capa continua aqui, com a lombada e o brilho ao marcar. O que ela perdeu
 * foi o monopólio da informação — ela ilustra a linha em vez de ser a única
 * coisa na linha. A sinopse também continua, agora atrás de um link discreto
 * ("ler a sinopse") em vez de ser o único caminho para saber do que se trata.
 *
 * ── O riscado ─────────────────────────────────────────────────────────────
 *
 * `precoAvulsoCentavos` é o preço do livro sozinho, e está declarado no
 * catálogo justamente para que o "de" seja um número que existe. Ver o
 * comentário longo em `nucleo/biblioteca/catalogo.ts` sobre por que um
 * riscado inventado não entra aqui.
 */

export interface EbookDoCheckout {
  id: string;
  titulo: string;
  promessa: string;
  sinopse: string;
  capitulos: number;
  precoCentavos: number;
  precoAvulsoCentavos: number;
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function desconto(e: EbookDoCheckout): number {
  if (e.precoAvulsoCentavos <= e.precoCentavos) return 0;
  return Math.round((1 - e.precoCentavos / e.precoAvulsoCentavos) * 100);
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

  // O maior desconto da estante vira o número da chamada. É o que o print do
  // marketing faz ("com 90% de desconto") e é honesto desde que seja o maior
  // de verdade e a palavra "até" esteja lá.
  const maiorDesconto = Math.max(...ebooks.map(desconto));

  return (
    <section className="relative flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 className="font-corpo text-[0.68rem] tracking-[0.18em] uppercase text-vela">
          {maiorDesconto > 0
            ? `Leve junto com até ${maiorDesconto}% de desconto`
            : 'Leve junto'}
        </h2>
        <p className="font-corpo font-light text-[0.66rem] text-pergaminho/35">
          Só agora, dentro deste pedido. Fica na sua biblioteca para sempre.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {ebooks.map((e, i) => {
          const marcado = marcados.includes(e.id);
          const off = desconto(e);
          return (
            <div
              key={e.id}
              className="rounded-xl border p-3 flex flex-col gap-2.5 transition"
              style={{
                borderColor: marcado
                  ? 'rgba(217,164,65,0.55)'
                  : 'color-mix(in srgb, var(--pergaminho) 14%, transparent)',
                background: marcado ? 'rgba(217,164,65,0.07)' : 'transparent',
                // A entrada escalonada: cada livro chega 90ms depois do
                // anterior, como quem põe três volumes na prateleira.
                animation: `livroChega 620ms cubic-bezier(.2,.8,.2,1) ${i * 90}ms both`,
              }}
            >
              <div className="flex items-start gap-3">
                {/*
                  A caixa de marcar, no canto onde todo checkout põe.

                  Ela é `aria-hidden` e não recebe foco de propósito: o alvo
                  acessível é o botão inteiro lá embaixo, que diz em palavras
                  o que faz. Duas coisas focáveis para a mesma ação fariam o
                  leitor de tela anunciar a oferta duas vezes.
                */}
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 size-[18px] rounded-[5px] border flex items-center justify-center transition"
                  style={{
                    borderColor: marcado
                      ? 'var(--vela)'
                      : 'color-mix(in srgb, var(--pergaminho) 30%, transparent)',
                    background: marcado ? 'var(--vela)' : 'transparent',
                  }}
                >
                  {marcado && <Check size={12} strokeWidth={3} className="text-tinta" />}
                </span>

                <button
                  type="button"
                  onClick={() => setAberto(aberto === e.id ? null : e.id)}
                  aria-expanded={aberto === e.id}
                  aria-label={`Ler a sinopse de ${e.titulo}`}
                  className="group relative shrink-0 w-[52px]"
                >
                  <span
                    className="relative block w-full aspect-[3/4] rounded-[3px] overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-[2px]"
                    style={{
                      boxShadow: marcado
                        ? '0 8px 18px -8px rgba(0,0,0,0.8), 0 0 0 1.5px var(--vela)'
                        : '0 5px 14px -8px rgba(0,0,0,0.75), 0 0 0 1px rgba(234,224,204,0.10)',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/biblioteca/capa/${e.id}`}
                      alt=""
                      className="w-full h-full object-cover transition duration-500"
                      style={{
                        filter: marcado ? 'none' : 'saturate(0.85) brightness(0.85)',
                      }}
                    />
                    {/*
                      A lombada: faixa escura na borda esquerda com um fio de
                      luz. É o que faz o retângulo virar livro em vez de
                      cartão, e custa duas linhas de gradiente.
                    */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 w-[6px]"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 45%, rgba(255,255,255,0.10) 72%, transparent 100%)',
                      }}
                    />
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
                  </span>
                </button>

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <h3 className="font-corpo font-medium text-[0.82rem] leading-snug text-pergaminho">
                    {e.titulo}
                  </h3>
                  <p className="font-corpo font-light text-[0.72rem] leading-snug text-pergaminho/50">
                    {e.promessa}
                  </p>

                  {/*
                    Preço e âncora na mesma linha, com `flex-wrap`: em 320px
                    os dois números não cabem lado a lado, e o que não pode
                    acontecer de jeito nenhum é o preço final sair cortado —
                    esse bug acabou de ser corrigido nos cartões de plano.
                  */}
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-0.5">
                    {e.precoAvulsoCentavos > e.precoCentavos && (
                      <span className="font-corpo text-[0.72rem] text-pergaminho/35 line-through tabular-nums">
                        {reais(e.precoAvulsoCentavos)}
                      </span>
                    )}
                    <span className="font-corpo font-medium text-[0.95rem] text-vela tabular-nums">
                      {reais(e.precoCentavos)}
                    </span>
                    {off > 0 && (
                      <span className="font-corpo text-[0.58rem] tracking-[0.12em] uppercase text-vela/70 border border-vela/30 rounded-full px-1.5 py-px">
                        {`-${off}%`}
                      </span>
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={() => setAberto(e.id)}
                    className="self-start font-corpo font-light text-[0.66rem] text-pergaminho/40 underline underline-offset-2 hover:text-vela transition"
                  >
                    ler a sinopse
                  </button>
                </div>
              </div>

              {/*
                O botão que decide, em largura cheia e com verbo.

                Na versão anterior o gesto de marcar era um retângulo pequeno
                com o preço dentro e nenhum verbo — dava para olhar aquilo e
                não saber que era clicável. "Adicionar ao pedido" é feio de
                tão comum, e é exatamente por isso que funciona.
              */}
              <button
                type="button"
                role="checkbox"
                aria-checked={marcado}
                onClick={() => aoMarcar(e.id)}
                className="w-full rounded-lg py-2 font-corpo text-[0.78rem] transition border"
                style={
                  marcado
                    ? {
                        borderColor: 'color-mix(in srgb, var(--pergaminho) 20%, transparent)',
                        color: 'color-mix(in srgb, var(--pergaminho) 55%, transparent)',
                        background: 'transparent',
                      }
                    : {
                        borderColor: 'rgba(217,164,65,0.55)',
                        color: 'var(--vela)',
                        background: 'rgba(217,164,65,0.10)',
                        fontWeight: 500,
                      }
                }
              >
                {marcado ? 'Tirar do pedido' : `Adicionar por ${reais(e.precoCentavos)}`}
              </button>
            </div>
          );
        })}
      </div>

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
                : `Adicionar por ${reais(emAberto.precoCentavos)}`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
