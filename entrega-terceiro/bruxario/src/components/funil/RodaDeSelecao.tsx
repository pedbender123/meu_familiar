'use client';

import { useEffect, useRef, useState } from 'react';

const ALTURA_ITEM = 52;
const VISIVEIS = 5;

/**
 * Uma coluna de rolagem, no padrão de seletor nativo.
 *
 * ── O que estava ruim na versão anterior ──────────────────────────────────
 *
 * Ela usava `scroll-snap` do navegador com um `setTimeout` de 90ms para ler o
 * valor. Três problemas, todos sentidos como "a rolagem está estranha":
 *
 *  1. **O valor só mudava quando a rolagem PARAVA.** Durante o gesto, o item
 *     do meio já era outro e o rótulo continuava o antigo — no funil de data
 *     isso significa o signo mudando com atraso, que é justamente o momento
 *     que deveria encantar.
 *  2. **O snap brigava com o dedo.** O navegador tentava encaixar enquanto a
 *     inércia ainda corria, e a coluna dava aquele solavanco de voltar.
 *  3. **Escala e opacidade eram calculadas por índice**, não pela posição
 *     real. Enquanto a coluna rolava, todos os itens ficavam no mesmo estado
 *     visual até o fim — a roda parecia uma lista, não um disco.
 *
 * Agora a posição é lida a cada quadro com `requestAnimationFrame`: o item
 * central acende **durante** o gesto, e cada item recebe escala, opacidade e
 * uma leve rotação em X conforme a distância REAL até o centro. É o que faz
 * ler como cilindro girando em vez de lista deslizando.
 *
 * O snap continua sendo o do navegador, porque é ele que dá a inércia certa
 * no celular — só deixou de ser a fonte da verdade sobre o valor.
 */
export function RodaDeSelecao({
  opcoes,
  valor,
  onChange,
  aria,
}: {
  opcoes: { valor: number; rotulo: string }[];
  valor: number;
  onChange: (v: number) => void;
  aria: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const programatico = useRef(false);
  const [deslocamento, setDeslocamento] = useState(0);

  const indice = Math.max(0, opcoes.findIndex((o) => o.valor === valor));

  /**
   * Lê a posição a cada quadro enquanto a coluna se move.
   *
   * Um `requestAnimationFrame` em laço só enquanto há rolagem — parar quando
   * a posição estabiliza evita um laço eterno consumindo bateria numa tela
   * que costuma ficar aberta enquanto a pessoa pensa.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let quadro = 0;
    let ultima = -1;
    let parados = 0;

    const ler = () => {
      const topo = el.scrollTop;
      setDeslocamento(topo);

      if (Math.abs(topo - ultima) < 0.5) {
        parados += 1;
      } else {
        parados = 0;
        ultima = topo;
      }

      // Passou de ~250ms sem se mover: assenta no item mais próximo e para.
      if (parados > 15) {
        if (!programatico.current) {
          const i = Math.round(topo / ALTURA_ITEM);
          const opt = opcoes[Math.max(0, Math.min(opcoes.length - 1, i))];
          if (opt && opt.valor !== valor) onChange(opt.valor);
        }
        return;
      }
      quadro = requestAnimationFrame(ler);
    };

    const aoRolar = () => {
      cancelAnimationFrame(quadro);
      parados = 0;
      quadro = requestAnimationFrame(ler);

      /**
       * O valor muda DURANTE o gesto, não no fim.
       *
       * É o que faz o signo acompanhar o dedo na roda de nascimento. Sem
       * isto o rótulo do centro fica sempre um passo atrás de onde a pessoa
       * está olhando.
       */
      if (programatico.current) return;
      const i = Math.round(el.scrollTop / ALTURA_ITEM);
      const opt = opcoes[Math.max(0, Math.min(opcoes.length - 1, i))];
      if (opt && opt.valor !== valor) onChange(opt.valor);
    };

    el.addEventListener('scroll', aoRolar, { passive: true });
    setDeslocamento(el.scrollTop);
    return () => {
      el.removeEventListener('scroll', aoRolar);
      cancelAnimationFrame(quadro);
    };
  }, [opcoes, valor, onChange]);

  // Recentraliza quando o valor muda de fora (trocar o mês pode invalidar o
  // dia 31). `programatico` impede que esse ajuste dispare um onChange.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const alvo = indice * ALTURA_ITEM;
    if (Math.abs(el.scrollTop - alvo) > ALTURA_ITEM * 0.6) {
      programatico.current = true;
      el.scrollTo({ top: alvo, behavior: 'auto' });
      setDeslocamento(alvo);
      window.setTimeout(() => {
        programatico.current = false;
      }, 80);
    }
  }, [indice]);

  const respiro = (ALTURA_ITEM * (VISIVEIS - 1)) / 2;
  const centro = deslocamento / ALTURA_ITEM;

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={aria}
      tabIndex={0}
      className="relative overflow-y-auto no-scrollbar snap-y snap-mandatory flex-1 outline-none"
      style={{
        height: ALTURA_ITEM * VISIVEIS,
        // `proximity` em vez de `mandatory`: o encaixe acontece, mas não briga
        // com o dedo no meio do gesto — era daí que vinha o solavanco.
        scrollSnapType: 'y proximity',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        maskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)',
      }}
    >
      <div style={{ height: respiro }} />
      {opcoes.map((opt, i) => {
        // Distância REAL até o centro, contínua — é o que faz o disco girar.
        const d = Math.abs(i - centro);
        const perto = Math.min(1, d / 2.2);
        const escala = 1 - perto * 0.3;
        const opacidade = 1 - perto * 0.78;
        const giro = Math.max(-58, Math.min(58, (i - centro) * 26));

        return (
          <button
            key={opt.valor}
            role="option"
            aria-selected={i === indice}
            onClick={() => onChange(opt.valor)}
            className="w-full snap-center flex items-center justify-center font-display tabular-nums"
            style={{
              height: ALTURA_ITEM,
              fontSize: `${1.15 + (1 - perto) * 0.55}rem`,
              color: d < 0.5 ? 'var(--escrita)' : 'var(--escrita-corpo)',
              opacity: opacidade,
              transform: `perspective(560px) rotateX(${giro}deg) scale(${escala})`,
              fontWeight: d < 0.5 ? 500 : 400,
              willChange: 'transform, opacity',
            }}
          >
            {opt.rotulo}
          </button>
        );
      })}
      <div style={{ height: respiro }} />
    </div>
  );
}

export { ALTURA_ITEM };
