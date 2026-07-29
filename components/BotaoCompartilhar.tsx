'use client';

import { useState } from 'react';
import { Share2, Download } from 'lucide-react';

async function compartilharOuBaixar(url: string, nomeArquivo: string, textoCompartilhar: string) {
  try {
    const resposta = await fetch(url);
    const blob = await resposta.blob();
    const arquivo = new File([blob], nomeArquivo, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: textoCompartilhar });
      return;
    }
  } catch {
    // segue para o download simples
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
}

export function BotaoCompartilhar({ pedidoId, textoCompartilhar }: { pedidoId: string; textoCompartilhar: string }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
      >
        <Share2 size={16} strokeWidth={1.75} /> Compartilhar
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute z-20 mt-2 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-tinta border border-pergaminho/15 rounded-2xl p-2 shadow-xl min-w-[220px]">
            <button
              onClick={() => {
                setAberto(false);
                compartilharOuBaixar(`/api/storage/${pedidoId}/story.png`, 'meu-familiar-story.png', textoCompartilhar);
              }}
              className="flex items-center gap-2 font-corpo text-sm text-pergaminho px-4 py-3 rounded-xl hover:bg-pergaminho/10 transition text-left"
            >
              <Download size={15} strokeWidth={1.5} /> Story (1080×1920)
            </button>
            <button
              onClick={() => {
                setAberto(false);
                compartilharOuBaixar(`/api/storage/${pedidoId}/feed.png`, 'meu-familiar-feed.png', textoCompartilhar);
              }}
              className="flex items-center gap-2 font-corpo text-sm text-pergaminho px-4 py-3 rounded-xl hover:bg-pergaminho/10 transition text-left"
            >
              <Download size={15} strokeWidth={1.5} /> Feed (1080×1350)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
