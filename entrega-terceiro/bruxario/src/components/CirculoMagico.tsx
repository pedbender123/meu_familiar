'use client';

const SIGNOS_GLIFOS = [
  'M12 5a5 5 0 1 0 -4 8', // áries (simplificado)
  'M12 3v18M8 7l4 -4l4 4', // touro
  'M6 4v16M18 4v16M6 10h12M6 16h12', // gêmeos
  'M4 10a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 10a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
  'M4 12a8 4 0 1 0 16 0a8 4 0 1 0 -16 0M4 12v0a8 4 0 0 0 16 0',
  'M6 4l6 16l6 -16',
  'M4 8h16M4 16h16M8 4v16M16 4v16',
  'M12 3v18M7 8l-3 4l3 4M17 8l3 4l-3 4',
  'M4 6l16 12M4 18l16 -12',
  'M6 20v-10a6 6 0 0 1 12 0v10',
  'M4 8q4 -4 8 0q4 4 8 0M4 16q4 -4 8 0q4 4 8 0',
  'M12 3c-4 3 -4 8 0 9c-4 1 -4 6 0 9c4 -3 4 -8 0 -9c4 -1 4 -6 0 -9',
];

export function CirculoMagico() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }} aria-hidden="true">
      <svg
        viewBox="0 0 220 220"
        width="220"
        height="220"
        className="absolute inset-0 anel-girando"
      >
        <circle
          cx="110"
          cy="110"
          r="95"
          fill="none"
          stroke="var(--violeta-bruma)"
          strokeWidth="1"
          opacity="0.35"
        />
        {SIGNOS_GLIFOS.map((d, i) => {
          const angulo = (i / SIGNOS_GLIFOS.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.round((110 + 95 * Math.cos(angulo)) * 100) / 100;
          const y = Math.round((110 + 95 * Math.sin(angulo)) * 100) / 100;
          return (
            <g key={i} transform={`translate(${x - 9}, ${y - 9})`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--vela)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
                <path d={d} />
              </svg>
            </g>
          );
        })}
      </svg>

      <svg viewBox="0 0 220 220" width="220" height="220" className="absolute inset-0 anel-progresso">
        <circle
          cx="110"
          cy="110"
          r="70"
          fill="none"
          stroke="var(--vela)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="440"
          pathLength={440}
          className="traco-preenchendo"
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-2">
        <svg width="34" height="52" viewBox="0 0 40 64" className="chama-central">
          <path
            d="M20 4 C10 20, 6 32, 20 40 C34 32, 30 20, 20 4 Z"
            fill="var(--vela)"
          />
          <path
            d="M20 16 C15 26, 14 32, 20 36 C26 32, 25 26, 20 16 Z"
            fill="#FFF3D6"
            opacity="0.9"
          />
        </svg>
      </div>

      <style>{`
        .anel-girando {
          animation: girar 24s linear infinite;
        }
        .anel-progresso {
          animation: girar 24s linear infinite reverse;
        }
        .traco-preenchendo {
          animation: preencher 3.6s ease-in-out infinite;
          transform-origin: 110px 110px;
        }
        .chama-central {
          animation: tremular 2.2s ease-in-out infinite;
          transform-origin: 20px 40px;
        }
        @keyframes girar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes preencher {
          0% { stroke-dashoffset: 440; opacity: 0.3; }
          50% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -440; opacity: 0.3; }
        }
        @keyframes tremular {
          0%, 100% { transform: rotate(-2deg) scaleY(1); }
          50% { transform: rotate(2deg) scaleY(1.06); }
        }
        @media (prefers-reduced-motion: reduce) {
          .anel-girando, .anel-progresso, .traco-preenchendo, .chama-central {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
