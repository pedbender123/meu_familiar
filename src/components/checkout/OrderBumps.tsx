'use client';

import { Check, BookOpen } from 'lucide-react';

/**
 * Os ebooks marcados junto da compra.
 *
 * ── Por que isto converte, e o cuidado que exige ──────────────────────────
 *
 * Quem está aqui já decidiu comprar e está com o cartão na mão. A decisão de
 * somar R$ 9,90 é muito mais barata que a decisão de comprar do zero — é por
 * isso que o bump existe, e é por isso que ele fica ANTES do botão de pagar e
 * não numa página nova.
 *
 * O cuidado é o inverso da mesma força: um bloco grande demais rouba a
 * atenção da compra que já estava fechada. Por isso as linhas são compactas,
 * sem imagem grande e sem argumento de venda — título, promessa de uma linha,
 * preço. Quem quer, marca; quem não quer, nem lê.
 *
 * ── Marcado é escolha, nunca padrão ───────────────────────────────────────
 *
 * Nenhuma caixa vem marcada. Bump pré-marcado é venda que a pessoa descobre
 * na fatura, e o que ela faz depois é pedir estorno e desconfiar do resto —
 * inclusive do produto que ela queria.
 *
 * ── O preço aqui é só a tela ──────────────────────────────────────────────
 *
 * O total exibido soma no navegador para a pessoa ver, mas **o valor cobrado
 * é recalculado no servidor** a partir dos ids, contra o catálogo. Ver
 * `somaDosBumps`. O que viaja daqui é a marcação, nunca o dinheiro.
 */

export interface EbookDoCheckout {
  id: string;
  titulo: string;
  promessa: string;
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
  if (ebooks.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <BookOpen size={13} strokeWidth={1.5} className="text-vela/70" />
        <h2 className="font-corpo text-[0.68rem] tracking-[0.16em] uppercase text-pergaminho/45">
          Leve junto
        </h2>
      </div>

      <div className="flex flex-col gap-1.5">
        {ebooks.map((e) => {
          const marcado = marcados.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              role="checkbox"
              aria-checked={marcado}
              onClick={() => aoMarcar(e.id)}
              className="group flex items-start gap-3 text-left rounded-xl border px-3.5 py-3 transition"
              style={{
                borderColor: marcado
                  ? 'rgba(217,164,65,0.55)'
                  : 'color-mix(in srgb, var(--pergaminho) 14%, transparent)',
                background: marcado ? 'rgba(217,164,65,0.07)' : 'transparent',
              }}
            >
              {/*
                A caixa desenhada à mão, e não um `<input type=checkbox>`: o
                nativo herda o azul do sistema operacional e destoa de tudo —
                num checkout, um elemento que parece de outro site é exatamente
                o que faz alguém desconfiar na hora de digitar o cartão.
              */}
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 w-[18px] h-[18px] rounded-[6px] border flex items-center justify-center transition"
                style={{
                  borderColor: marcado
                    ? 'var(--vela)'
                    : 'color-mix(in srgb, var(--pergaminho) 30%, transparent)',
                  background: marcado ? 'var(--vela)' : 'transparent',
                }}
              >
                {marcado && <Check size={12} strokeWidth={3} className="text-tinta" />}
              </span>

              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="font-corpo text-[0.82rem] leading-snug text-pergaminho/90">
                  {e.titulo}
                </span>
                <span className="font-corpo font-light text-[0.72rem] leading-snug text-pergaminho/45">
                  {e.promessa}
                </span>
              </span>

              <span
                className="font-corpo text-[0.82rem] tabular-nums shrink-0 mt-0.5 transition"
                style={{ color: marcado ? 'var(--vela)' : 'var(--pergaminho)', opacity: marcado ? 1 : 0.6 }}
              >
                + {reais(e.precoCentavos)}
              </span>
            </button>
          );
        })}
      </div>

      <p className="font-corpo font-light text-[0.68rem] leading-snug text-pergaminho/35 px-1">
        Fica na sua biblioteca para sempre, mesmo sem assinatura.
      </p>
    </section>
  );
}
