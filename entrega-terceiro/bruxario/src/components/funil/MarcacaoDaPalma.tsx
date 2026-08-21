'use client';

import { CONEXOES, PONTAS_DEDOS, paraPath, type PalmAnalysis } from '@/lib/palma/deteccao';

interface Props {
  photo: string;
  analise: PalmAnalysis | null;
  /** Quantas linhas já apareceram (para a revelação). Omitido = todas. */
  linhasVisiveis?: number;
  /** Miniatura esconde esqueleto e rótulos, que virariam sujeira no tamanho pequeno. */
  compacto?: boolean;
  className?: string;
}

/**
 * A foto com a marcação por cima. Usada grande na varredura e pequena no
 * perfil — em SVG, então a mesma marcação continua nítida em qualquer tamanho
 * e sobrevive à impressão em PDF.
 */
export function MarcacaoDaPalma({ photo, analise, linhasVisiveis, compacto = false, className = '' }: Props) {
  const res = analise?.res ?? 320;
  const linhas = analise ? analise.linhas.slice(0, linhasVisiveis ?? analise.linhas.length) : [];

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="Sua palma" className="w-full h-full object-cover sepia-[0.28] contrast-95 brightness-95" />

      {analise && (
        <svg viewBox={`0 0 ${res} ${res}`} className="absolute inset-0 w-full h-full pointer-events-none">
          {!compacto && analise.landmarks && (
            <g className="anima-contorno">
              {CONEXOES.map(([a, b], i) => (
                <line
                  key={i}
                  x1={analise.landmarks![a].x} y1={analise.landmarks![a].y}
                  x2={analise.landmarks![b].x} y2={analise.landmarks![b].y}
                  stroke="rgba(217,164,65,0.35)" strokeWidth={0.9}
                />
              ))}
              {analise.landmarks.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.3} fill="rgba(217,164,65,0.75)" />
              ))}
              {PONTAS_DEDOS.map((idx, i) => (
                <g key={idx} className="anima-ponta" style={{ animationDelay: `${i * 90}ms` }}>
                  <circle cx={analise.landmarks![idx].x} cy={analise.landmarks![idx].y} r={4.5} fill="none" stroke="#D9A441" strokeWidth={1} />
                  <circle cx={analise.landmarks![idx].x} cy={analise.landmarks![idx].y} r={1.6} fill="#D9A441" />
                </g>
              ))}
            </g>
          )}

          {!compacto && (
            <circle cx={analise.centro.x} cy={analise.centro.y} r={2.2} fill="rgba(217,164,65,0.85)" />
          )}

          {linhas.map((l) => (
            <g key={l.key}>
              <path
                d={paraPath(l.pontos)} fill="none" stroke="rgba(0,0,0,0.45)"
                strokeWidth={compacto ? 4 : 3} strokeLinecap="round" strokeLinejoin="round"
                className={compacto ? undefined : 'anima-traco'}
              />
              <path
                d={paraPath(l.pontos)} fill="none" stroke={l.cor}
                strokeWidth={compacto ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round"
                className={compacto ? undefined : 'anima-traco'}
              />
              {!compacto && l.pontos.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.9} fill={l.cor} stroke="rgba(0,0,0,0.5)" strokeWidth={0.6} className="anima-rotulo" />
              ))}
              {!compacto && (
                <text
                  x={l.rotulo.x} y={l.rotulo.y} fill={l.cor} fontSize={9} textAnchor="middle"
                  className="anima-rotulo"
                  style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.75)', strokeWidth: 2.5 }}
                >
                  {l.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
