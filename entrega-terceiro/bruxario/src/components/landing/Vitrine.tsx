'use client';

import Image from 'next/image';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';

/**
 * As doze artes veladas, em faixa rolável.
 *
 * ── Por que rolagem horizontal e não grade ────────────────────────────────
 *
 * Numa grade de 12 no celular, tudo fica minúsculo ou a seção fica com dois
 * metros de altura. A faixa mostra três por vez em tamanho que dá para
 * apreciar, e a borda cortada à direita é o que comunica "tem mais" sem
 * precisar de seta nem de biblioteca de carrossel.
 *
 * `snap` deixa o gesto travar em cada carta em vez de deslizar solto — é o que
 * faz parecer carrossel de app e não `overflow` de tabela.
 *
 * ── Os nomes não aparecem ─────────────────────────────────────────────────
 *
 * De propósito. A pessoa vê que existem doze criaturas distintas; qual é qual
 * ela descobre respondendo. Rotular aqui deixaria alguém escolher o favorito
 * antes do teste — e aí o teste não mede mais nada.
 */
export function Vitrine() {
  const ids = Object.keys(FAMILIARES) as FamiliarId[];

  return (
    <div
      className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-none"
      role="img"
      aria-label="Os doze familiares, parcialmente velados"
    >
      <ul className="flex gap-3 px-5 sm:justify-center sm:flex-wrap sm:px-0">
        {ids.map((id) => (
          <li
            key={id}
            className="snap-center shrink-0 w-[38vw] max-w-[150px] sm:w-[130px] aspect-square rounded-xl overflow-hidden border border-pergaminho/12"
          >
            <Image
              src={`/vitrine/${id}.webp`}
              alt=""
              width={420}
              height={420}
              className="w-full h-full object-cover"
              // Só as primeiras entram no carregamento inicial: as outras
              // estão fora da tela e não podem atrasar o hero.
              loading={ids.indexOf(id) < 3 ? 'eager' : 'lazy'}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
