'use client';

import { useState } from 'react';

/**
 * Um botão, e só.
 *
 * Não recebe e nem envia endereço: o destino do link é decidido no servidor a
 * partir de `ADMIN_EMAIL`. Mesmo que alguém forje o pedido com outro e-mail no
 * corpo, a rota ignora — é a razão de esta tela não ter superfície de ataque.
 */
export function BotaoDeAcessoAdmin() {
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado'>('parado');

  async function pedir() {
    setEstado('enviando');
    try {
      await fetch('/api/auth/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'admin' }),
      });
    } catch {
      // silêncio de propósito: a resposta é sempre a mesma
    }
    setEstado('enviado');
  }

  if (estado === 'enviado') {
    return (
      <p className="font-display italic text-xl text-escrita text-center max-w-[30ch]">
        Link enviado. Ele expira em 20 minutos e funciona uma vez só.
      </p>
    );
  }

  return (
    <button
      onClick={pedir}
      disabled={estado === 'enviando'}
      className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
    >
      {estado === 'enviando' ? 'Enviando...' : 'Acessar'}
    </button>
  );
}
