'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A folha de pergaminho: uma superfície apoiada no quarto escuro, não o fundo
 * da página.
 *
 * Esse é o conceito central da estética do Bruxário. O pergaminho **existe
 * dentro da noite** — é um objeto sobre uma mesa à luz de vela. Se ele virar o
 * fundo da tela, a identidade escura do produto morre e sobra um site bege.
 *
 * Três coisas fazem ler como objeto físico:
 *  - inclinação de meio grau (nada no mundo real está a 0,00°)
 *  - borda irregular em `clip-path`, como papel rasgado à mão
 *  - sombra dupla: curta e dura embaixo, difusa e longa em volta, mais um halo
 *    quente que é a vela batendo nele
 *
 * Regra de composição que vem de graça com o conceito: **o que é grimório vai
 * dentro da folha; o que é interface fica fora, no quarto.** Botão sobre
 * pergaminho lê como anacronismo.
 */

/** Borda de papel rasgado. Assimétrica de propósito — simetria denuncia CSS. */
const BORDA_RASGADA = `polygon(
  0.4% 0.6%, 22% 0%, 47% 0.9%, 71% 0.1%, 99.5% 0.7%,
  100% 24%, 99.2% 51%, 100% 77%, 99.4% 99.3%,
  74% 100%, 49% 99.1%, 26% 100%, 0.6% 99.4%,
  0% 76%, 0.8% 49%, 0% 23%
)`;

/**
 * Grão do papel gerado em Canvas e reaproveitado por toda a aplicação.
 *
 * Ruído concentrado no claro, não no escuro: papel tem fibra, não sujeira. Um
 * tile de 128px repetido custa alguns kB de data URL em vez de uma imagem que
 * o CSP do navegador teria que buscar.
 */
let graoEmCache: string | null = null;

function gerarGrao(): string {
  if (graoEmCache) return graoEmCache;

  const lado = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(lado, lado);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 26 + Math.random() * 26;
  }
  ctx.putImageData(img, 0, 0);
  graoEmCache = canvas.toDataURL();
  return graoEmCache;
}

export function FolhaPergaminho({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const fibra = useRef<HTMLSpanElement>(null);

  // O grão é escrito direto no DOM em vez de passar por estado: é uma textura
  // gerada uma vez que nunca muda, então não há por que provocar uma
  // renderização. Canvas não existe no servidor — sem ele a folha continua
  // correta, só mais lisa, e degradação silenciosa é o certo aqui.
  useEffect(() => {
    const el = fibra.current;
    if (!el) return;
    const grao = gerarGrao();
    if (grao) el.style.backgroundImage = `url(${grao})`;
  }, []);

  return (
    <article
      className={`relative w-full max-w-2xl text-escrita px-6 py-9 sm:px-14 sm:py-14 ${className}`}
      style={{
        background: 'var(--folha)',
        transform: 'rotate(-0.35deg)',
        clipPath: BORDA_RASGADA,
        boxShadow: [
          '0 2px 0 rgba(0,0,0,0.18)',
          '0 30px 60px -20px rgba(0,0,0,0.75)',
          '0 0 90px -30px rgba(217,164,65,0.28)',
        ].join(', '),
      }}
    >
      {/* fibra do papel */}
      <span
        ref={fibra}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundRepeat: 'repeat',
          mixBlendMode: 'multiply',
          opacity: 0.5,
        }}
      />

      {/* manchas de idade, concentradas nas bordas onde papel envelhece antes */}
      <span
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 30% 22% at 4% 8%, rgba(150,120,70,0.16), transparent 70%)',
            'radial-gradient(ellipse 26% 18% at 97% 30%, rgba(150,120,70,0.13), transparent 70%)',
            'radial-gradient(ellipse 34% 20% at 60% 99%, rgba(150,120,70,0.15), transparent 70%)',
            'radial-gradient(ellipse 20% 14% at 12% 88%, rgba(120,95,55,0.10), transparent 70%)',
          ].join(', '),
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6">{children}</div>
    </article>
  );
}
