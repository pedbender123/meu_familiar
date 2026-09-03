'use client';

import Image from 'next/image';
import { Check, Plus } from 'lucide-react';

/**
 * Os ebooks oferecidos junto, no momento em que a pessoa já decidiu comprar.
 *
 * ── Por que aqui, e não na página de vendas ───────────────────────────────
 *
 * A decisão de gastar R$ 9,90 a mais é muito mais barata que a decisão de
 * comprar do zero: o cartão já está na mão, o medo já passou, o "eu mereço"
 * já foi resolvido. Oferecer o mesmo livro na vitrine competiria com o
 * produto principal; oferecer aqui **soma** a ele.
 *
 * ── Marcar não pode parecer comprar de novo ───────────────────────────────
 *
 * Cada caixa muda o total na hora, e o total fica visível o tempo todo. O que
 * derruba a confiança num order bump é a pessoa marcar, não ver nada mudar, e
 * descobrir o valor real só na fatura — então o número que ela vê aqui é
 * exatamente o que o servidor vai cobrar.
 *
 * ── Preço vem do servidor ─────────────────────────────────────────────────
 *
 * Este componente recebe preço para DESENHAR. Quem soma o que será cobrado é
 * `somaDosBumps`, no servidor, a partir dos ids — valor que passa pelo
 * navegador é valor editável.
 */

export interface EbookDoCheckout {
  id: string;
  titulo: string;
  promessa: string;
  precoCentavos: number;
  /** `null` quando a capa ainda não chegou: o livro vende sem imagem. */
  capa: string | null;
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
  aoMarcar: (id: string) => void;
}) {
  if (ebooks.length === 0) return null;

  const somaCentavos = ebooks
    .filter((e) => marcados.includes(e.id))
    .reduce((s, e) => s + e.precoCentavos, 0);

  return (
    <section
      aria-label="Adicione ao seu pedido"
      className="w-full flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-corpo text-[0.7rem] tracking-[0.18em] uppercase text-vela/80">
          Some ao seu pedido
        </h2>
        <span className="font-corpo text-[11px] text-pergaminho/35">opcional</span>
      </div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {ebooks.map((e) => {
          const marcado = marcados.includes(e.id);
          return (
            <li key={e.id}>
              {/*
                O bloco inteiro é o botão, não só a caixinha.

                Alvo de toque de 20 pixels no celular é onde o order bump
                morre: a pessoa tenta marcar, erra, e desiste em vez de tentar
                de novo. Aqui qualquer lugar do cartão marca.
              */}
              <button
                type="button"
                onClick={() => aoMarcar(e.id)}
                aria-pressed={marcado}
                className="w-full flex items-center gap-3 text-left rounded-2xl border p-2.5 transition"
                style={{
                  borderColor: marcado
                    ? 'rgba(217,164,65,0.55)'
                    : 'color-mix(in srgb, var(--pergaminho) 15%, transparent)',
                  background: marcado
                    ? 'rgba(217,164,65,0.08)'
                    : 'transparent',
                }}
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition"
                  style={{
                    borderColor: marcado
                      ? 'var(--vela)'
                      : 'color-mix(in srgb, var(--pergaminho) 30%, transparent)',
                    background: marcado ? 'var(--vela)' : 'transparent',
                  }}
                >
                  {marcado ? (
                    <Check size={13} strokeWidth={3} className="text-tinta" />
                  ) : (
                    <Plus
                      size={12}
                      strokeWidth={2}
                      className="text-pergaminho/40"
                    />
                  )}
                </span>

                {/*
                  A capa é enfeite: sem ela o livro ainda vende, só aparece sem
                  imagem. Ver `biblioteca/LEIA-ME.md`.
                */}
                {e.capa && (
                  <span className="shrink-0 relative w-10 h-14 rounded-md overflow-hidden border border-pergaminho/10">
                    <Image
                      src={e.capa}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </span>
                )}

                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-corpo text-[13px] leading-tight text-pergaminho block">
                    {e.titulo}
                  </span>
                  <span className="font-corpo font-light text-[11.5px] leading-snug text-pergaminho/45 block">
                    {e.promessa}
                  </span>
                </span>

                <span
                  className="shrink-0 font-corpo text-sm tabular-nums"
                  style={{ color: marcado ? 'var(--vela)' : undefined }}
                >
                  + {reais(e.precoCentavos)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        A confirmação do que acabou de ser marcado, colada na caixinha.

        O total do pedido existe logo abaixo, no painel do gateway, e ele já
        muda sozinho. Mas ele fica a uma rolagem de distância do dedo que
        marcou — e feedback que aparece fora do campo de visão é feedback que
        não aconteceu. Esta linha é a resposta imediata; o total lá embaixo é
        a confirmação.
      */}
      {marcados.length > 0 && (
        <p
          className="font-corpo text-[11.5px] px-1 pt-0.5"
          style={{ color: 'var(--vela)' }}
        >
          {marcados.length === 1
            ? '1 ebook somado'
            : `${marcados.length} ebooks somados`}
          {' · '}
          {reais(somaCentavos)} a mais, já no total abaixo
        </p>
      )}
    </section>
  );
}
