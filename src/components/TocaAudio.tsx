'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Play/pausa customizado, no lugar do `<audio controls>` nativo.
 *
 * O controle do navegador quebra o clima — é uma barra cinza de sistema
 * operacional dentro de um grimório. Isto aqui é só um botão com ícone, do
 * mesmo jeito que o resto da interface (ver `AudioAmbiente.tsx`).
 *
 * ── `autoPlay` não é garantia ──────────────────────────────────────────────
 *
 * O navegador pode recusar tocar som sem gesto do usuário, principalmente na
 * primeira visita ao site (antes de existir histórico de engajamento com
 * áudio nesse domínio). Por isso a tentativa é silenciosa — se falhar, o
 * botão continua funcionando normalmente, é só um clique a mais.
 */
export function TocaAudio({
  src,
  rotulo,
  autoPlay = false,
}: {
  src: string;
  rotulo: string;
  autoPlay?: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);

  useEffect(() => {
    if (autoPlay) audio.current?.play().catch(() => {});
    // Só na montagem: autoPlay não deve reagir a re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alternar() {
    const el = audio.current;
    if (!el) return;
    if (tocando) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  }

  return (
    <button
      onClick={alternar}
      className="inline-flex items-center gap-2.5 rounded-full border border-vela/40 px-5 py-2.5 font-corpo text-sm text-vela hover:bg-vela/10 transition"
    >
      <audio
        ref={audio}
        src={src}
        preload={autoPlay ? 'auto' : 'none'}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => setTocando(false)}
      />
      {tocando ? <IconePausa /> : <IconePlay />}
      {tocando ? 'Pausar' : rotulo}
    </button>
  );
}

function IconePlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}

function IconePausa() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}
