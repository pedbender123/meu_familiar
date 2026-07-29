'use client';

export function Chama({ progresso }: { progresso: number }) {
  const p = Math.min(1, Math.max(0, progresso));
  const alturaChama = 22 + p * 20;
  const larguraChama = 12 + p * 8;

  return (
    <div className="flex flex-col items-center gap-2" aria-hidden="true">
      <svg width="40" height="64" viewBox="0 0 40 64" className="overflow-visible">
        <ellipse cx="20" cy="58" rx="3" ry="4" fill="var(--vela)" opacity="0.5" />
        <rect x="18" y="40" width="4" height="18" rx="2" fill="var(--pergaminho)" opacity="0.85" />
        <path
          className="chama-flutuante"
          d={`M20 ${40 - alturaChama} C ${20 - larguraChama / 2} ${40 - alturaChama * 0.45}, ${20 - larguraChama * 0.6} ${40 - alturaChama * 0.1}, 20 40 C ${20 + larguraChama * 0.6} ${40 - alturaChama * 0.1}, ${20 + larguraChama / 2} ${40 - alturaChama * 0.45}, 20 ${40 - alturaChama} Z`}
          fill="var(--vela)"
          style={{ transition: 'd 0.6s ease-out' }}
        />
        <path
          d={`M20 ${40 - alturaChama * 0.55} C ${20 - larguraChama * 0.22} ${40 - alturaChama * 0.3}, ${20 - larguraChama * 0.22} ${40 - alturaChama * 0.05}, 20 40 C ${20 + larguraChama * 0.22} ${40 - alturaChama * 0.05}, ${20 + larguraChama * 0.22} ${40 - alturaChama * 0.3}, 20 ${40 - alturaChama * 0.55} Z`}
          fill="#FFF3D6"
          opacity="0.9"
          style={{ transition: 'd 0.6s ease-out' }}
        />
      </svg>
      <style>{`
        .chama-flutuante {
          animation: tremular 2.4s ease-in-out infinite;
          transform-origin: 20px 40px;
        }
        @keyframes tremular {
          0%, 100% { transform: rotate(-1.5deg) scaleY(1); }
          50% { transform: rotate(1.5deg) scaleY(1.04); }
        }
      `}</style>
    </div>
  );
}
