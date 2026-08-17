'use client';

import type { Simbolo } from '@/modulos/oraculo/espetaculos';

/**
 * O céu do espetáculo: estrelas acendendo e a linha se traçando entre elas.
 *
 * ── Por que não é um mapa astronômico de verdade ──────────────────────────
 *
 * Projetar as posições reais numa esfera celeste daria um emaranhado ilegível
 * numa caixa de 300px — e o que o momento pede não é precisão de planetário,
 * é a sensação de algo sendo desenhado no escuro.
 *
 * A **posição** é decorativa; o **símbolo** é que é real (veio de
 * `espetaculos/ceu.ts`, calculado). Essa divisão é honesta: o texto afirma o
 * que foi calculado, o desenho ilustra. O que seria desonesto é o contrário —
 * um mapa com aparência de exatidão mostrando coordenada inventada.
 */
const ESTRELAS = [
  { x: 22, y: 30 },
  { x: 48, y: 18 },
  { x: 74, y: 34 },
  { x: 62, y: 62 },
  { x: 30, y: 68 },
  { x: 50, y: 44 },
];

export function CeuTracado({
  simbolos,
  revelados,
  posicoes,
}: {
  simbolos: Simbolo[];
  revelados: number;
  posicoes: { planeta: string; signo: string }[];
}) {
  return (
    <div className="w-full flex flex-col items-center gap-4">
      <svg
        viewBox="0 0 100 90"
        className="w-full max-w-[19rem]"
        aria-hidden="true"
        style={{ overflow: 'visible' }}
      >
        {/* poeira de fundo */}
        {Array.from({ length: 26 }, (_, i) => {
          const x = (i * 37) % 100;
          const y = (i * 53) % 90;
          return (
            <circle
              key={`p${i}`}
              cx={x}
              cy={y}
              r={0.4}
              fill="var(--pergaminho)"
              opacity={0.12 + ((i * 7) % 10) / 60}
            />
          );
        })}

        {/* as linhas da constelação, traçando conforme revela */}
        {ESTRELAS.slice(0, Math.max(0, revelados + 1)).map((estrela, i, lista) => {
          if (i === 0) return null;
          const anterior = lista[i - 1];
          return (
            <line
              key={`l${i}`}
              x1={anterior.x}
              y1={anterior.y}
              x2={estrela.x}
              y2={estrela.y}
              stroke="var(--vela)"
              strokeWidth="0.4"
              opacity="0.5"
              /* `tracarLinha` já existe em globals.css (usado na roda de
                 nascimento) — reaproveitado em vez de um keyframe novo com
                 outro nome fazendo a mesma coisa. */
              style={{ strokeDasharray: 120, animation: 'tracarLinha 1.2s ease-out forwards' }}
            />
          );
        })}

        {ESTRELAS.map((estrela, i) => {
          const aceso = i < revelados + 1;
          const dourada = simbolos[i]?.dourado;
          return (
            <g key={`e${i}`}>
              {aceso && (
                <circle
                  cx={estrela.x}
                  cy={estrela.y}
                  r={dourada ? 4 : 2.6}
                  fill={dourada ? 'var(--vela)' : 'var(--pergaminho)'}
                  opacity="0.14"
                />
              )}
              <circle
                cx={estrela.x}
                cy={estrela.y}
                r={dourada ? 1.5 : 1}
                fill={dourada ? 'var(--vela)' : 'var(--pergaminho)'}
                opacity={aceso ? (dourada ? 1 : 0.85) : 0.15}
                style={{ transition: 'opacity 900ms ease-out' }}
              />
            </g>
          );
        })}
      </svg>

      {/* Os símbolos que já apareceram, em texto — o que é calculado de verdade. */}
      <div className="flex flex-col items-center gap-1.5 px-4 min-h-[3rem]">
        {simbolos.slice(0, revelados).map((simbolo) => (
          <p
            key={simbolo.nome}
            className="font-display italic text-base text-center leading-tight"
            style={{
              color: simbolo.dourado ? 'var(--vela)' : 'rgb(234 224 204 / 0.85)',
            }}
          >
            {simbolo.nome}
            <span className="font-corpo text-[0.6rem] not-italic text-pergaminho/35">
              {' '}
              · {simbolo.posicao}
            </span>
          </p>
        ))}
      </div>

      {revelados === 0 && posicoes.length > 0 && (
        <p className="font-corpo text-[0.62rem] text-pergaminho/25">
          lendo o céu deste minuto...
        </p>
      )}
    </div>
  );
}
