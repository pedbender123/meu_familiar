'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefereMenosMovimento } from '@/lib/movimento';

/**
 * Revela o texto palavra por palavra, com o desfoque saindo — a sensação é de
 * tinta assentando no papel, não de elemento aparecendo.
 *
 * Dois cuidados que fazem a diferença entre "escrita" e "efeito de site":
 *
 *  - **26 ms por palavra** (~460 palavras/min). Rápido o bastante para não
 *    testar a paciência de ninguém, lento o bastante para a mão ser visível.
 *  - **Só começa quando o parágrafo entra na tela.** Sem isso a leitura toda
 *    "escreve" enquanto a pessoa ainda olha a carta, e ela chega num texto já
 *    pronto — o efeito acontece sem ninguém ver.
 *
 * Com `prefers-reduced-motion` o texto simplesmente já está lá, e é isso que o
 * servidor renderiza também.
 */
const MS_POR_PALAVRA = 26;

export function TextoEscrito({
  children,
  className,
  atrasoInicial = 0,
}: {
  children: string;
  className?: string;
  /** ms antes da primeira palavra. Serve para encadear blocos. */
  atrasoInicial?: number;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const { alvo, visivel } = useEntrouNaTela<HTMLParagraphElement>(
    !semMovimento,
    0.15
  );

  if (semMovimento) {
    return (
      <p ref={alvo} className={className}>
        {children}
      </p>
    );
  }

  const palavras = children.trim().split(/\s+/);

  return (
    <p ref={alvo} className={className}>
      {palavras.map((palavra, i) => {
        const atraso = atrasoInicial + i * MS_POR_PALAVRA;
        return (
          <span
            key={i}
            style={{
              opacity: visivel ? 1 : 0,
              filter: visivel ? 'blur(0)' : 'blur(2px)',
              transition: `opacity 0.5s ease ${atraso}ms, filter 0.5s ease ${atraso}ms`,
            }}
          >
            {palavra}
            {i < palavras.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </p>
  );
}

/** Igual em espírito, mas para blocos com marcação dentro. */
export function BlocoRevelado({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const { alvo, visivel: entrouNaTela } = useEntrouNaTela<HTMLDivElement>(
    !semMovimento,
    0.2
  );
  const visivel = semMovimento || entrouNaTela;

  return (
    <div
      ref={alvo}
      className={className}
      style={{
        opacity: visivel ? 1 : 0,
        transform: visivel ? 'none' : 'translateY(8px)',
        transition: 'opacity 0.9s ease, transform 0.9s ease',
      }}
    >
      {children}
    </div>
  );
}

/**
 * Observa quando o elemento entra na tela, uma vez só.
 *
 * O `setState` aqui vem do callback do IntersectionObserver — um sistema
 * externo avisando —, não do corpo do efeito. É a distinção que a regra
 * `set-state-in-effect` existe para proteger.
 */
function useEntrouNaTela<T extends HTMLElement>(ativo: boolean, limiar: number) {
  const alvo = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!ativo) return;
    const el = alvo.current;
    if (!el) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas[0].isIntersecting) return;
        setVisivel(true);
        observador.disconnect();
      },
      { threshold: limiar }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [ativo, limiar]);

  return { alvo, visivel };
}
