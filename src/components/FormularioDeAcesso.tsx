'use client';

import { useState } from 'react';

/**
 * Pede o link mágico.
 *
 * A tela de sucesso é a mesma exista ou não a conta — é a contraparte visível
 * da resposta uniforme da API. Se ela dissesse "não encontramos esse e-mail",
 * qualquer um poderia usar esta caixa para descobrir quem é cliente.
 */
export function FormularioDeAcesso() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  async function pedir() {
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/auth/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tipo: 'conta' }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'Não conseguimos enviar agora. Tente de novo.');
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não conseguimos enviar agora. Tente de novo.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-display italic text-xl text-escrita max-w-[30ch]">
          Se existe uma conta com esse e-mail, o link já está a caminho.
        </p>
        <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[36ch] leading-relaxed">
          Ele vale por 20 minutos e funciona uma vez só. Se não aparecer, olhe
          no spam.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 self-stretch max-w-sm mx-auto w-full">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && email.trim() && pedir()}
        autoFocus
        placeholder="seu@email.com"
        className="bg-transparent border border-escrita/25 rounded-xl px-5 py-4 text-center text-lg text-escrita placeholder:text-escrita-fraca/60 focus:border-ouro-velho outline-none font-corpo"
      />
      {erro && <p className="font-corpo text-sm text-center text-red-700">{erro}</p>}
      <button
        onClick={pedir}
        disabled={enviando || !email.trim()}
        className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {enviando ? 'Enviando...' : 'Me manda o link'}
      </button>
    </div>
  );
}
