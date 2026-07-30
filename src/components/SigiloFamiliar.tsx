'use client';

import { useEffect, useRef } from 'react';
import type { Sigilo } from '@/lib/familiares';

/**
 * O sigilo do familiar, traçado a bico de pena sobre o pergaminho.
 *
 * A figura vem da geometria definida em `lib/familiares.ts` (N pontos no
 * círculo, ligados de `passo` em `passo`), então cada familiar tem sua própria
 * e sempre a mesma. Nada é desenhado à mão e nada é aleatório: o sigilo é
 * assinatura, e assinatura que muda não serve.
 *
 * O traço acelera no começo e assenta no fim — pena de verdade não tem
 * velocidade constante.
 */
export function SigiloFamiliar({
  sigilo,
  tamanho = 240,
}: {
  sigilo: Sigilo;
  tamanho?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = cv.height = tamanho * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const centro = tamanho / 2;
    const raio = tamanho * 0.367;

    const vertices = Array.from({ length: sigilo.pontos }, (_, i) => {
      const angulo = (i / sigilo.pontos) * Math.PI * 2 - Math.PI / 2;
      return {
        x: centro + raio * Math.cos(angulo),
        y: centro + raio * Math.sin(angulo),
      };
    });

    // Salta de `passo` em `passo` até voltar ao início. Quando passo e pontos
    // têm divisor comum, isso fecha antes de visitar todos — de propósito.
    const ordem: { x: number; y: number }[] = [];
    let atual = 0;
    do {
      ordem.push(vertices[atual]);
      atual = (atual + sigilo.passo) % sigilo.pontos;
    } while (atual !== 0);
    ordem.push(vertices[0]);

    const segmentos = ordem.length - 1;
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duracao = semMovimento ? 0 : 2600;

    function desenhar(progresso: number) {
      ctx!.clearRect(0, 0, tamanho, tamanho);

      // círculo externo: sempre completo, discreto — é a moldura do sigilo
      ctx!.strokeStyle = 'rgba(107,95,114,0.32)';
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.arc(centro, centro, raio + tamanho * 0.058, 0, Math.PI * 2);
      ctx!.stroke();

      ctx!.strokeStyle = 'rgba(46,36,56,0.62)';
      ctx!.lineWidth = 1.3;
      ctx!.lineCap = 'round';
      ctx!.lineJoin = 'round';

      const avanco = progresso * segmentos;
      ctx!.beginPath();
      ctx!.moveTo(ordem[0].x, ordem[0].y);
      for (let i = 0; i < segmentos; i++) {
        const t = Math.min(1, Math.max(0, avanco - i));
        if (t <= 0) break;
        const a = ordem[i];
        const b = ordem[i + 1];
        ctx!.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
      ctx!.stroke();

      // nós nos vértices já alcançados
      ctx!.fillStyle = 'rgba(138,106,47,0.85)';
      for (let i = 0; i <= Math.floor(avanco) && i < ordem.length; i++) {
        ctx!.beginPath();
        ctx!.arc(ordem[i].x, ordem[i].y, 2, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    if (duracao === 0) {
      desenhar(1);
      return;
    }

    let inicio: number | null = null;
    let animacao = 0;
    function animar(t: number) {
      if (inicio === null) inicio = t;
      const p = Math.min(1, (t - inicio) / duracao);
      // ease-out: a pena começa rápido e assenta
      desenhar(1 - Math.pow(1 - p, 2.2));
      if (p < 1) animacao = requestAnimationFrame(animar);
    }
    animacao = requestAnimationFrame(animar);

    return () => cancelAnimationFrame(animacao);
  }, [sigilo, tamanho]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      style={{ width: tamanho, height: tamanho }}
      className="block"
    />
  );
}
