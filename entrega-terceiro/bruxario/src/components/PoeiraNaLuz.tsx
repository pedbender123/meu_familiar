'use client';

import { useEffect, useRef } from 'react';

/**
 * Poeira suspensa na luz da vela.
 *
 * Existe para o ar não parecer morto — não para ser notada. Por isso as
 * partículas são lentas, quase transparentes, e **somem conforme descem**: só
 * brilham onde a luz da vela alcança, que é o terço de cima da tela. Poeira
 * uniforme por toda a página leria como "efeito de site", não como ar.
 *
 * Canvas em vez de elementos: 70 divs animadas custariam layout a cada quadro.
 */
export function PoeiraNaLuz() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    interface Particula {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      a: number;
    }
    let particulas: Particula[] = [];
    let quadro = 0;

    function dimensionar() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv!.width = window.innerWidth * dpr;
      cv!.height = window.innerHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const quantidade = Math.round(Math.min(70, window.innerWidth / 16));
      particulas = Array.from({ length: quantidade }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 0.4 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.09,
        vy: -0.06 - Math.random() * 0.14,
        a: 0.06 + Math.random() * 0.2,
      }));
    }

    function desenhar() {
      const { innerWidth: L, innerHeight: A } = window;
      ctx!.clearRect(0, 0, L, A);
      for (const p of particulas) {
        p.y += p.vy;
        p.x += p.vx;
        if (p.y < -6) {
          p.y = A + 6;
          p.x = Math.random() * L;
        }
        if (p.x < -6) p.x = L + 6;
        if (p.x > L + 6) p.x = -6;

        const alcanceDaVela = 1 - Math.min(1, p.y / (A * 0.75));
        ctx!.globalAlpha = p.a * alcanceDaVela;
        ctx!.fillStyle = '#F2D9A0';
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      quadro = requestAnimationFrame(desenhar);
    }

    dimensionar();
    window.addEventListener('resize', dimensionar);
    quadro = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', dimensionar);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none opacity-50 z-0"
    />
  );
}
