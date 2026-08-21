'use client';

import { useState } from 'react';

/**
 * A porta do painel: um campo de e-mail e um botão.
 *
 * ── O que mudou, e o que continua valendo ─────────────────────────────────
 *
 * Antes não havia campo nenhum: o destino do link vinha de `ADMIN_EMAIL` no
 * servidor, e era isso que tornava a tela inatacável — não havia para onde
 * apontar. Com a equipe do painel existem várias caixas de entrada válidas, e
 * a garantia passou a ser outra: **a resposta é idêntica para qualquer
 * endereço**.
 *
 * Digite o e-mail do dono, o de alguém da equipe ou um inventado — a tela diz
 * a mesma frase nos três casos. Só sai link para quem está na lista, e não há
 * como descobrir daqui quem está. É o mesmo desenho da porta da conta.
 */
export function BotaoDeAcessoAdmin() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');

  async function pedir() {
    if (!email.trim() || estado === 'enviando') return;
    setEstado('enviando');
    try {
      await fetch('/api/auth/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'admin', email }),
      });
    } catch {
      // silêncio de propósito: a resposta é sempre a mesma
    }
    setEstado('enviado');
  }

  if (estado === 'enviado') {
    return (
      <p className="font-display italic text-xl text-escrita text-center max-w-[32ch]">
        Se esse endereço tiver acesso, o link já está a caminho. Ele expira em
        20 minutos e funciona uma vez só.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 self-stretch">
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && pedir()}
        placeholder="seu@email.com"
        aria-label="Seu e-mail"
        autoFocus
        className="bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita placeholder:text-escrita-fraca focus:border-ouro-velho outline-none"
      />
      <button
        onClick={pedir}
        disabled={estado === 'enviando' || !email.trim()}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-3 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {estado === 'enviando' ? 'Enviando...' : 'Receber o link'}
      </button>
    </div>
  );
}
