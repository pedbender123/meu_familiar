'use client';

import { useEffect, useRef, useState } from 'react';
import { GlifoZodiaco } from './GlifoZodiaco';
import type { Signo } from '@/lib/astro';
import { usePrefereMenosMovimento } from '@/lib/movimento';

/**
 * Sol e lua ligados por um traço.
 *
 * Duas variantes, porque o mesmo desenho não funciona nos dois fundos:
 *  - `papel` — tinta sobre pergaminho, como anotação a bico de pena. É o que a
 *    tela de revelação usa, dentro da folha.
 *  - `quarto` — luz sobre escuro, para quando estiver no ambiente.
 *
 * Só começa a traçar quando entra na tela. No meio da folha, um traço que
 * acontece antes de a pessoa rolar até ali é um traço que ninguém viu.
 */
const PALETA = {
  papel: {
    traco: '#6B5F72',
    tracoOpacidade: 0.65,
    astro: '#8A6A2F',
    glifo: 'var(--escrita)',
    legenda: 'text-escrita-fraca',
  },
  quarto: {
    traco: 'var(--violeta-bruma)',
    tracoOpacidade: 1,
    astro: 'var(--vela)',
    glifo: 'var(--pergaminho)',
    legenda: 'text-pergaminho/70',
  },
} as const;

type Paleta = (typeof PALETA)[keyof typeof PALETA];

export function Constelacao({
  signoSol,
  signoLua,
  variante = 'quarto',
}: {
  signoSol: Signo;
  signoLua: Signo;
  variante?: 'papel' | 'quarto';
}) {
  const semMovimento = usePrefereMenosMovimento();
  const [entrouNaTela, setEntrouNaTela] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const cor = PALETA[variante];

  // Sem movimento, o traço já está completo — não há o que observar.
  const tracado = semMovimento || entrouNaTela;

  useEffect(() => {
    if (semMovimento) return;
    const el = svg.current;
    if (!el) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting) return;
        setEntrouNaTela(true);
        observador.disconnect();
      },
      { threshold: 0.4 }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [semMovimento]);

  const pontos = [
    { x: 24, y: 46 },
    { x: 140, y: 18 },
    { x: 256, y: 46 },
  ];
  const caminho = `M ${pontos[0].x} ${pontos[0].y} L ${pontos[1].x} ${pontos[1].y} L ${pontos[2].x} ${pontos[2].y}`;

  return (
    <div className="flex flex-col items-center gap-3 w-full" aria-hidden="true">
      <svg ref={svg} width="280" height="70" viewBox="0 0 280 70" className="max-w-full">
        <path
          d={caminho}
          fill="none"
          stroke={cor.traco}
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity={cor.tracoOpacidade}
          strokeDasharray="300"
          strokeDashoffset={tracado ? 0 : 300}
          style={{ transition: 'stroke-dashoffset 2.2s ease-in-out' }}
        />
        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === 1 ? 2.2 : 2.6}
            fill={cor.astro}
            opacity={tracado ? 1 : 0}
            style={{ transition: `opacity 0.5s ease ${0.5 + i * 0.55}s` }}
          />
        ))}
      </svg>

      <div className="flex items-start justify-center gap-10 sm:gap-16 -mt-4">
        <Astro rotulo={`Sol em ${signoSol}`} signo={signoSol} cor={cor} />
        <Astro rotulo={`Lua em ${signoLua}`} signo={signoLua} cor={cor} />
      </div>
    </div>
  );
}

function Astro({
  rotulo,
  signo,
  cor,
}: {
  rotulo: string;
  signo: Signo;
  cor: Paleta;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <GlifoZodiaco signo={signo} size={24} stroke={1.4} color={cor.glifo} />
      <span className={`font-corpo text-xs tracking-wide ${cor.legenda}`}>{rotulo}</span>
    </div>
  );
}
