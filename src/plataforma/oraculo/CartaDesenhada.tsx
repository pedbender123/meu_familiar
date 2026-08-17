'use client';

/**
 * Os 22 arcanos, desenhados.
 *
 * ── Por que não usar as artes clássicas ───────────────────────────────────
 *
 * Rider-Waite e Marselha existem em versões de domínio público, mas destoam
 * de tudo aqui: o Bruxário é sigilo geométrico em canvas, lua em SVG,
 * constelação traçada — linguagem de traço, não de ilustração pintada. Carta
 * de baralho comercial no meio disso lê como figurinha colada.
 *
 * Então cada arcano vira um **glifo geométrico** na mesma gramática dos
 * sigilos: ouro sobre pergaminho, linhas finas, simetria imperfeita. Ganha
 * coerência e não depende de licença de ninguém.
 *
 * O glifo é derivado do nome, não desenhado à mão um por um: um polígono cujo
 * número de lados e rotação saem das letras. Duas cartas nunca saem iguais, e
 * a mesma carta sai sempre igual.
 */
function semeadoPor(nome: string): { lados: number; giro: number; raios: number } {
  let soma = 0;
  for (let i = 0; i < nome.length; i++) soma += nome.charCodeAt(i) * (i + 1);

  return {
    lados: 3 + (soma % 7), // 3 a 9 lados
    giro: soma % 360,
    raios: 2 + (soma % 4), // 2 a 5 raios internos
  };
}

function pontosDoPoligono(lados: number, raio: number, giro: number): string {
  return Array.from({ length: lados }, (_, i) => {
    const angulo = (i / lados) * Math.PI * 2 + (giro * Math.PI) / 180 - Math.PI / 2;
    return `${(50 + raio * Math.cos(angulo)).toFixed(2)},${(50 + raio * Math.sin(angulo)).toFixed(2)}`;
  }).join(' ');
}

export function CartaDesenhada({
  nome,
  posicao,
  dourada = false,
  virada = true,
  largura = 96,
}: {
  nome: string;
  posicao?: string;
  /** A quarta carta do dia de ouro: moldura e brilho próprios. */
  dourada?: boolean;
  /** `false` = de costas, ainda não virou. */
  virada?: boolean;
  largura?: number;
}) {
  const { lados, giro, raios } = semeadoPor(nome);
  const cor = dourada ? 'var(--vela)' : 'var(--ouro-velho)';

  return (
    <figure
      className="flex flex-col items-center gap-2 shrink-0"
      style={{ width: largura }}
    >
      <div
        className="relative w-full rounded-lg overflow-hidden transition-all duration-700"
        style={{
          aspectRatio: '2 / 3',
          background: virada
            ? 'linear-gradient(160deg, #E7DCC4, #D8CBAE)'
            : 'linear-gradient(160deg, #2A2038, #1A1428)',
          border: `1px solid ${dourada ? 'var(--vela)' : 'rgba(138,106,47,0.45)'}`,
          boxShadow: dourada
            ? '0 0 24px -4px rgba(217,164,65,0.55), 0 6px 16px -6px rgba(0,0,0,0.7)'
            : '0 6px 16px -8px rgba(0,0,0,0.7)',
          // Meio grau de inclinação: nada no mundo real está a 0,00°.
          transform: `rotate(${(giro % 5) - 2}deg)`,
        }}
      >
        {virada ? (
          <svg viewBox="0 0 100 150" className="w-full h-full" aria-hidden="true">
            {/* moldura interna */}
            <rect
              x="6" y="6" width="88" height="138" rx="3"
              fill="none" stroke={cor} strokeWidth="0.6" opacity="0.4"
            />

            <g transform="translate(0, 28)">
              {/* o polígono do arcano */}
              <polygon
                points={pontosDoPoligono(lados, 30, giro)}
                fill="none"
                stroke={cor}
                strokeWidth="1"
                opacity="0.85"
              />
              {/* raios do centro aos vértices */}
              {Array.from({ length: lados }, (_, i) => {
                if (i % Math.max(1, Math.floor(lados / raios)) !== 0) return null;
                const angulo = (i / lados) * Math.PI * 2 + (giro * Math.PI) / 180 - Math.PI / 2;
                return (
                  <line
                    key={i}
                    x1="50" y1="50"
                    x2={50 + 30 * Math.cos(angulo)}
                    y2={50 + 30 * Math.sin(angulo)}
                    stroke={cor}
                    strokeWidth="0.5"
                    opacity="0.5"
                  />
                );
              })}
              <circle cx="50" cy="50" r="3" fill={cor} opacity="0.9" />
              <circle cx="50" cy="50" r="34" fill="none" stroke={cor} strokeWidth="0.4" opacity="0.3" />
            </g>

            <text
              x="50" y="128"
              textAnchor="middle"
              fill="var(--escrita)"
              style={{ fontSize: '8px', fontStyle: 'italic' }}
              fontFamily="Cormorant Garamond, Georgia, serif"
            >
              {nome}
            </text>
          </svg>
        ) : (
          /* O verso: a mesma trama pra todas, como um baralho de verdade. */
          <svg viewBox="0 0 100 150" className="w-full h-full" aria-hidden="true">
            <rect x="5" y="5" width="90" height="140" rx="3" fill="none" stroke="var(--violeta-bruma)" strokeWidth="0.6" opacity="0.5" />
            {Array.from({ length: 7 }, (_, i) => (
              <circle
                key={i}
                cx="50" cy="75" r={8 + i * 8}
                fill="none" stroke="var(--violeta-bruma)" strokeWidth="0.4" opacity="0.28"
              />
            ))}
            <circle cx="50" cy="75" r="3" fill="var(--vela)" opacity="0.7" />
          </svg>
        )}
      </div>

      {posicao && virada && (
        <figcaption className="font-corpo text-[0.55rem] text-center leading-tight text-pergaminho/40">
          {posicao}
        </figcaption>
      )}
    </figure>
  );
}
