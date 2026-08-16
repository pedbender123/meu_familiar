'use client';

import { useState } from 'react';

export function FormularioDeResgate({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'pronto'>('parado');
  const [erro, setErro] = useState('');

  async function resgatar() {
    if (!email.trim()) return;
    setErro('');
    setEstado('enviando');
    try {
      const r = await fetch('/api/resgatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      });
      const d = await r.json();
      if (d.ok) setEstado('pronto');
      else {
        setErro(d.erro || 'Não deu para resgatar.');
        setEstado('parado');
      }
    } catch {
      setErro('Não deu para resgatar agora.');
      setEstado('parado');
    }
  }

  if (estado === 'pronto') {
    return (
      <p className="font-display italic text-xl text-ouro-profundo">
        Pronto. As consultas já estão na sua conta.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 self-stretch">
      <input
        autoFocus
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && resgatar()}
        placeholder="seu@email.com"
        aria-label="E-mail da sua conta"
        className="bg-transparent border-b border-escrita/25 focus:border-ouro-velho outline-none px-1 py-3 font-corpo text-lg text-escrita text-center placeholder:text-escrita-fraca/50 transition-colors"
      />
      {erro && <p className="font-corpo text-sm text-red-700">{erro}</p>}
      <button
        onClick={resgatar}
        disabled={estado === 'enviando' || !email.trim()}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-3.5 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {estado === 'enviando' ? 'Resgatando...' : 'Resgatar'}
      </button>
    </div>
  );
}
