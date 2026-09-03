'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  alternarTrilha,
  assinarTrilha,
  definirVolumeDaTrilha,
  estadoDaTrilha,
  estadoDaTrilhaNoServidor,
  pausarTrilha,
  tocarTrilha,
} from '@/lib/trilha';
import type { Trilha } from '@/nucleo/trilhas/catalogo';

/**
 * O tocador da plataforma — o disco que fica girando no canto da mesa.
 *
 * ── O que ele é ───────────────────────────────────────────────────────────
 *
 * Uma pastilha pequena, fixa no canto, que abre numa lista de faixas. Ela
 * segue a pessoa por todas as telas da conta: escolheu chuva na revelação,
 * continua chovendo no Oráculo e dentro do livro. É o contrário do áudio de
 * fundo do site, que era uma decisão nossa que a pessoa só podia desligar.
 *
 * ── Por que é interface, e nunca entra na folha ───────────────────────────
 *
 * Regra da estética: o que é grimório vai dentro do pergaminho, o que é
 * interface fica fora, no quarto escuro. Um tocador de música desenhado sobre
 * papel de grimório seria a coisa mais anacrônica desta plataforma — então ele
 * é feito de vidro escuro, luz de vela e nada mais.
 *
 * ── As faixas trancadas aparecem ──────────────────────────────────────────
 *
 * Quem não assina vê o nome e a descrição das outras, apagados, com o cadeado.
 * Esconder faria a lista parecer completa com duas faixas — e o que não
 * aparece não vende. Clicar numa trancada leva aos planos, que é a resposta
 * honesta para "eu quero essa".
 */
export function Tocador({
  trilhas,
  assinaturaAtiva,
}: {
  trilhas: Trilha[];
  /** Ouve tudo. Quem não assina ouve as gratuitas. */
  assinaturaAtiva: boolean;
}) {
  const estado = useSyncExternalStore(
    assinarTrilha,
    estadoDaTrilha,
    estadoDaTrilhaNoServidor
  );
  const [aberto, setAberto] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  const liberadas = trilhas.filter((t) => t.gratuita || assinaturaAtiva);
  const atual =
    trilhas.find((t) => t.id === estado.id) ?? liberadas[0] ?? trilhas[0] ?? null;
  const podeTocarAtual = !!atual && (atual.gratuita || assinaturaAtiva);

  /**
   * O elemento de áudio segue o estado, e não o contrário.
   *
   * `play()` devolve uma promessa que o navegador rejeita quando não houve
   * gesto ainda — e a rejeição não tratada vira erro no console de todo
   * mundo. O `catch` silencioso é proposital: o botão continua ali, e o
   * segundo clique funciona.
   */
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = estado.volume;
    if (estado.tocando && podeTocarAtual) el.play().catch(() => {});
    else el.pause();
  }, [estado.tocando, estado.volume, estado.id, podeTocarAtual]);

  if (trilhas.length === 0) return null;

  return (
    <div className="fixed z-40 bottom-3 left-3 sm:bottom-5 sm:left-5 flex flex-col items-start gap-2 print:hidden">
      {atual && (
        <audio
          ref={audio}
          src={atual.arquivo}
          loop
          preload="none"
          onPlay={() => tocarTrilha(atual.id)}
          onPause={() => pausarTrilha()}
        />
      )}

      {aberto && (
        <div className="w-[min(80vw,290px)] max-h-[62vh] overflow-y-auto rounded-2xl border border-pergaminho/15 bg-tinta/92 backdrop-blur-md shadow-2xl shadow-black/40 p-2.5 flex flex-col gap-1">
          <p className="font-corpo text-[10px] tracking-[0.22em] uppercase text-pergaminho/35 px-2 pt-1 pb-1.5">
            Trilhas
          </p>

          {trilhas.map((trilha) => {
            const liberada = trilha.gratuita || assinaturaAtiva;
            const tocandoEsta = estado.tocando && estado.id === trilha.id;

            if (!liberada) {
              return (
                <Link
                  key={trilha.id}
                  href="/planos"
                  className="group flex items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-pergaminho/5 transition-colors"
                >
                  <Cadeado />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-corpo text-[13px] text-pergaminho/40 group-hover:text-pergaminho/70 transition-colors">
                      {trilha.nome}
                    </span>
                    <span className="font-corpo text-[11px] leading-snug text-pergaminho/25">
                      {trilha.descricao}
                    </span>
                  </span>
                </Link>
              );
            }

            return (
              <button
                key={trilha.id}
                onClick={() => alternarTrilha(trilha.id)}
                className="group flex items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-pergaminho/5 transition-colors"
              >
                <span className="mt-[3px] shrink-0">
                  {tocandoEsta ? <Ondas /> : <PlayPequeno />}
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span
                    className={`font-corpo text-[13px] transition-colors ${
                      tocandoEsta ? 'text-vela' : 'text-pergaminho/75 group-hover:text-pergaminho'
                    }`}
                  >
                    {trilha.nome}
                  </span>
                  <span className="font-corpo text-[11px] leading-snug text-pergaminho/35">
                    {trilha.descricao}
                  </span>
                </span>
              </button>
            );
          })}

          {/*
            O volume mora dentro da lista, e não na pastilha.

            Fora dela seria mais um controle visível o tempo todo numa
            interface que já tem menu, e o volume é a coisa que se ajusta uma
            vez por mês. Quem abriu a lista está mexendo no som — é ali que
            ele faz sentido.
          */}
          <label className="flex items-center gap-2.5 px-2 pt-2 pb-1 mt-1 border-t border-pergaminho/10">
            <span className="sr-only">Volume da trilha</span>
            <AltoFalante />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(estado.volume * 100)}
              onChange={(e) => definirVolumeDaTrilha(Number(e.target.value) / 100)}
              className="flex-1 h-1 accent-[var(--vela)] cursor-pointer"
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-1.5 rounded-full border border-pergaminho/15 bg-tinta/85 backdrop-blur-sm pl-1 pr-1">
        <button
          onClick={() => atual && alternarTrilha(atual.id)}
          disabled={!podeTocarAtual}
          aria-label={estado.tocando ? 'Pausar a trilha' : 'Tocar a trilha'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-pergaminho/70 hover:text-vela disabled:opacity-30 transition-colors"
        >
          {estado.tocando ? <Pausa /> : <Play />}
        </button>

        <button
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
          className="flex items-center gap-2 pr-3 py-1.5 text-left"
        >
          <span className="font-corpo text-[11px] leading-none text-pergaminho/45 max-w-[14ch] truncate">
            {atual?.nome ?? 'sem trilha'}
          </span>
          <Seta aberto={aberto} />
        </button>
      </div>
    </div>
  );
}

/* ── ícones ──────────────────────────────────────────────────────────────
   Desenhados aqui, como o resto da interface: um pacote de ícones inteiro
   para seis formas de 16px é peso de download que a pessoa paga sem receber
   nada em troca. */

function Play() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" />
    </svg>
  );
}

function Pausa() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" fill="currentColor" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" fill="currentColor" />
    </svg>
  );
}

function PlayPequeno() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" className="text-pergaminho/30">
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" />
    </svg>
  );
}

/** Três barrinhas que sobem e descem — a faixa que está tocando agora. */
function Ondas() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="text-vela">
      <rect x="0.5" y="4" width="2.4" height="4" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="4;9;4" dur="1.1s" repeatCount="indefinite" />
        <animate attributeName="y" values="4;1.5;4" dur="1.1s" repeatCount="indefinite" />
      </rect>
      <rect x="4.8" y="2" width="2.4" height="8" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="8;3;8" dur="0.9s" repeatCount="indefinite" />
        <animate attributeName="y" values="2;4.5;2" dur="0.9s" repeatCount="indefinite" />
      </rect>
      <rect x="9.1" y="3.5" width="2.4" height="5" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="5;9;5" dur="1.35s" repeatCount="indefinite" />
        <animate attributeName="y" values="3.5;1.5;3.5" dur="1.35s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function Cadeado() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" className="mt-[3px] shrink-0 text-pergaminho/25">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" />
      <path
        d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill="none"
      />
    </svg>
  );
}

function AltoFalante() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-pergaminho/35 shrink-0">
      <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Seta({ aberto }: { aberto: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`text-pergaminho/35 transition-transform ${aberto ? 'rotate-180' : ''}`}
    >
      <path d="M2 4.5 6 8.5l4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
