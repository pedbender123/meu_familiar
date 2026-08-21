'use client';

import { useEffect, useState } from 'react';
import { usePrefereMenosMovimento } from '@/lib/movimento';

/**
 * Pede a opinião de quem comprou, depois de a pessoa ter lido.
 *
 * ── Por que só depois de rolar ────────────────────────────────────────────
 *
 * Pedir opinião antes de a pessoa ler é pedir opinião sobre nada — e
 * atrapalha justamente o momento que ela pagou para ter. O aviso espera 70%
 * da página. Quem não desceu até lá não leu, e não tem o que dizer.
 *
 * ── E por que ele some para sempre ao ser dispensado ──────────────────────
 *
 * Um pedido de avaliação que reaparece a cada visita é praga. O "não agora"
 * fica gravado no navegador; a pessoa não é perguntada de novo.
 */
const CHAVE = 'bruxario:opiniao-dispensada:';

export function PedidoDeOpiniao({
  pedidoId,
  jaComentou,
}: {
  pedidoId: string;
  jaComentou: boolean;
}) {
  const semMovimento = usePrefereMenosMovimento();
  const [visivel, setVisivel] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (jaComentou) return;
    if (localStorage.getItem(CHAVE + pedidoId)) return;

    function aoRolar() {
      const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
      if (alturaTotal <= 0) return;
      const fracao = window.scrollY / alturaTotal;
      if (fracao >= 0.7) {
        setVisivel(true);
        window.removeEventListener('scroll', aoRolar);
      }
    }

    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, [pedidoId, jaComentou]);

  function dispensar() {
    localStorage.setItem(CHAVE + pedidoId, '1');
    setVisivel(false);
  }

  async function enviar() {
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/comentario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, texto }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'Não conseguimos guardar agora.');
        setEnviando(false);
        return;
      }
      localStorage.setItem(CHAVE + pedidoId, '1');
      setEnviado(true);
    } catch {
      setErro('Não conseguimos guardar agora.');
      setEnviando(false);
    }
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-label="O que você achou"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 pointer-events-none"
    >
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-vela/30 bg-tinta/95 backdrop-blur px-5 py-4 shadow-2xl flex flex-col gap-3"
        style={{
          animation: semMovimento ? undefined : 'subir 0.5s cubic-bezier(0.2,0.8,0.2,1) both',
        }}
      >
        {enviado ? (
          <p className="font-display italic text-lg text-pergaminho text-center py-2">
            Obrigado. Isso ajuda mais do que parece.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="font-display italic text-lg leading-snug text-pergaminho">
                O que você achou?
              </p>
              <button
                onClick={dispensar}
                aria-label="Agora não"
                className="shrink-0 text-pergaminho/40 hover:text-pergaminho/80 transition text-xl leading-none px-1"
              >
                ×
              </button>
            </div>

            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, 400))}
              rows={3}
              autoFocus
              placeholder="Bateu? Errou? O que ficou na cabeça?"
              className="bg-transparent border border-pergaminho/20 rounded-xl px-3.5 py-2.5 text-pergaminho placeholder:text-pergaminho/35 focus:border-vela outline-none font-corpo font-light text-sm resize-none"
            />

            {erro && <p className="font-corpo text-xs text-red-300">{erro}</p>}

            <div className="flex items-center justify-between gap-3">
              <span className="font-corpo text-[0.68rem] text-pergaminho/40 leading-snug max-w-[22ch]">
                Se você deixar, pode aparecer no mural — só depois de a gente ler.
              </span>
              <button
                onClick={enviar}
                disabled={enviando || texto.trim().length < 4}
                className="shrink-0 bg-vela text-tinta font-corpo font-medium text-sm px-5 py-2.5 rounded-full hover:brightness-110 transition disabled:opacity-40"
              >
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes subir {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
