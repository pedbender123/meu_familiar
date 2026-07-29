'use client';

import { useEffect, useState } from 'react';
import { GlifoZodiaco } from './GlifoZodiaco';
import type { Signo } from '@/lib/astro';

export function Constelacao({ signoSol, signoLua }: { signoSol: Signo; signoLua: Signo }) {
  const [traçado, setTraçado] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTraçado(true), 200);
    return () => clearTimeout(t);
  }, []);

  const pontos = [
    { x: 30, y: 50 },
    { x: 150, y: 20 },
    { x: 270, y: 50 },
  ];

  const caminho = `M ${pontos[0].x} ${pontos[0].y} L ${pontos[1].x} ${pontos[1].y} L ${pontos[2].x} ${pontos[2].y}`;

  return (
    <div className="flex flex-col items-center gap-3" aria-hidden="true">
      <svg width="300" height="90" viewBox="0 0 300 90" className="overflow-visible">
        <path
          d={caminho}
          fill="none"
          stroke="var(--violeta-bruma)"
          strokeWidth="1.5"
          strokeDasharray="500"
          strokeDashoffset={traçado ? 0 : 500}
          style={{ transition: 'stroke-dashoffset 2.2s ease-in-out' }}
        />
        {pontos.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="var(--vela)"
            opacity={traçado ? 1 : 0}
            style={{ transition: `opacity 0.4s ease ${0.6 + i * 0.5}s` }}
          />
        ))}
      </svg>
      <div className="flex items-center gap-10 -mt-16">
        <div className="flex flex-col items-center gap-1">
          <GlifoZodiaco signo={signoSol} size={26} stroke={1.5} color="var(--pergaminho)" />
          <span className="font-corpo text-xs text-pergaminho/70">Sol em {signoSol}</span>
        </div>
        <div className="w-6" />
        <div className="flex flex-col items-center gap-1">
          <GlifoZodiaco signo={signoLua} size={26} stroke={1.5} color="var(--pergaminho)" />
          <span className="font-corpo text-xs text-pergaminho/70">Lua em {signoLua}</span>
        </div>
      </div>
    </div>
  );
}
