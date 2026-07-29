'use client';

import { useState } from 'react';

export function FormularioOraculo({ nomeSecreto }: { nomeSecreto: string }) {
  const [email, setEmail] = useState('');
  const [pergunta, setPergunta] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!email.trim() || !pergunta.trim()) return;
    setEnviando(true);
    try {
      await fetch('/api/oraculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pergunta }),
      });
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p className="font-corpo font-light text-sm text-pergaminho/80 text-center">
        Sua pergunta foi guardada. {nomeSecreto} vai lembrar dela.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu@email.com"
        className="bg-transparent border border-pergaminho/20 rounded-lg px-4 py-3 text-pergaminho focus:border-vela outline-none font-corpo text-sm"
      />
      <textarea
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value)}
        placeholder="Deixe a pergunta que você faria"
        rows={2}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-4 py-3 text-pergaminho focus:border-vela outline-none font-corpo text-sm resize-none"
      />
      <button
        onClick={enviar}
        disabled={enviando}
        className="border border-vela text-vela font-corpo text-sm px-6 py-3 rounded-full hover:bg-vela/10 transition disabled:opacity-60"
      >
        {enviando ? 'Guardando...' : 'Guardar minha pergunta'}
      </button>
    </div>
  );
}
