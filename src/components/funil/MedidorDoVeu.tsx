'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefereMenosMovimento } from '@/lib/movimento';
import { BotaoDoRitual } from './PassoDoRitual';

/**
 * O orbe que enche entre os passos.
 *
 * ── Por que líquido e não anel ────────────────────────────────────────────
 *
 * A primeira versão era um anel de progresso — a mesma coisa que uma barra de
 * download. Não vende nada porque não é de lugar nenhum: é widget de interface
 * num produto que promete um objeto mágico.
 *
 * O orbe enche como um frasco: o nível sobe, a superfície ondula, e há um halo
 * ao redor que fica mais forte conforme aproxima do cheio. A pessoa está vendo
 * alguma coisa **acontecer**, não um indicador reportando.
 *
 * ── O número é verdadeiro ─────────────────────────────────────────────────
 *
 * Funis deste formato costumam mostrar "precisão da previsão: 34%" — número
 * inventado, que existe só para criar sensação de progresso. Aqui é quanto do
 * perfil já foi preenchido, e cada item pesa porque de fato muda a leitura.
 * A mecânica funciona igual sem a afirmação falsa, e afirmação falsa sobre o
 * produto é o que vira reclamação e estorno.
 */
export function MedidorDoVeu({
  percentual,
  titulo,
  legenda,
  rotuloDoBotao = 'Continuar',
  onContinuar,
}: {
  percentual: number;
  titulo: string;
  legenda: string;
  rotuloDoBotao?: string;
  onContinuar: () => void;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const [valor, setValor] = useState(semMovimento ? percentual : 0);
  const partida = useRef(semMovimento ? percentual : 0);

  useEffect(() => {
    if (semMovimento) {
      setValor(percentual);
      return;
    }
    const de = partida.current;
    const inicio = performance.now();
    let vivo = true;

    const passo = (agora: number) => {
      if (!vivo) return;
      const t = Math.min(1, (agora - inicio) / 1400);
      // Desacelera no fim: o nível "assenta" em vez de travar de repente.
      const suave = 1 - Math.pow(1 - t, 3);
      const atual = de + (percentual - de) * suave;
      setValor(atual);
      partida.current = atual;
      if (t < 1) requestAnimationFrame(passo);
    };
    const id = requestAnimationFrame(passo);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [percentual, semMovimento]);

  const cheio = valor / 100;

  return (
    <div className="w-full max-w-md flex flex-col items-center gap-7 anima-surgir">
      <h2 className="font-display italic text-[1.9rem] sm:text-[2.1rem] text-pergaminho text-center text-balance leading-tight">
        {titulo}
      </h2>

      <div className="relative size-56">
        {/*
          O halo cresce com o nível. É o que faz o orbe parecer ganhar carga em
          vez de só encher — no escuro do quarto, a luz vazando é o que dá a
          sensação de que tem alguma coisa viva ali dentro.
        */}
        <div
          aria-hidden="true"
          className="absolute -inset-8 rounded-full pointer-events-none transition-opacity duration-700"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--vela) 30%, transparent) 0%, transparent 68%)',
            opacity: 0.25 + cheio * 0.75,
          }}
        />

        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{
            border: '1px solid color-mix(in srgb, var(--vela) 30%, transparent)',
            background: 'color-mix(in srgb, var(--tinta) 55%, transparent)',
            boxShadow: `inset 0 0 40px -8px color-mix(in srgb, var(--vela) ${20 + cheio * 40}%, transparent)`,
          }}
        >
          {/* O líquido. */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: `${valor}%`,
              background:
                'linear-gradient(to top, color-mix(in srgb, var(--ouro-velho) 62%, transparent), color-mix(in srgb, var(--violeta) 38%, transparent))',
            }}
          >
            {/*
              Duas ondas em velocidades diferentes na superfície. Uma só lê
              como faixa deslizando; duas se cruzam e o olho aceita como água.
            */}
            {!semMovimento && (
              <>
                <Onda duracao={7} opacidade={0.5} deslocamento={0} />
                <Onda duracao={11} opacidade={0.3} deslocamento={-40} />
              </>
            )}
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className="font-display text-[3.4rem] leading-none text-pergaminho tabular-nums"
            style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
          >
            {Math.round(valor)}%
          </span>
          <span className="font-corpo text-[0.62rem] tracking-[0.22em] uppercase text-pergaminho/55 mt-1.5">
            do véu
          </span>
        </div>
      </div>

      <p className="font-display italic text-[1.2rem] text-pergaminho/75 text-center max-w-[30ch] leading-relaxed">
        {legenda}
      </p>

      <BotaoDoRitual onClick={onContinuar}>{rotuloDoBotao}</BotaoDoRitual>
    </div>
  );
}

/** Uma onda na superfície do líquido. */
function Onda({
  duracao,
  opacidade,
  deslocamento,
}: {
  duracao: number;
  opacidade: number;
  deslocamento: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 240 24"
      preserveAspectRatio="none"
      className="absolute left-0 -top-3 h-6"
      style={{
        width: '200%',
        opacity: opacidade,
        animation: `deslizarOnda ${duracao}s linear infinite`,
        transform: `translateX(${deslocamento}px)`,
      }}
    >
      <path
        d="M0 12 Q 30 4 60 12 T 120 12 T 180 12 T 240 12 V24 H0 Z"
        fill="color-mix(in srgb, var(--vela) 55%, transparent)"
      />
    </svg>
  );
}
