'use client';

import { useState } from 'react';

/**
 * O recado que fica esperando o Oráculo abrir.
 *
 * **Não chama IA nenhuma e não responde nada** — é um bilhete guardado. O
 * texto deixa isso explícito antes da caixa, porque a pior forma de decepção
 * aqui seria alguém escrever esperando resposta e não receber.
 *
 * Vive na conta, e não na página de revelação: aqui a pessoa está
 * identificada pela sessão (nada de pedir e-mail outra vez) e está num lugar
 * que é dela, não numa página que estranhos também abrem com o link.
 */
export function RecadoParaOOraculo({ nomeSecreto }: { nomeSecreto?: string | null }) {
  const [pergunta, setPergunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const LIMITE = 500;

  async function enviar() {
    if (!pergunta.trim()) return;
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/oraculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d.erro || 'Não conseguimos guardar agora. Tente de novo.');
        setEnviando(false);
        return;
      }
      setEnviado(true);
    } catch {
      setErro('Não conseguimos guardar agora. Tente de novo.');
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <p className="font-display italic text-lg text-escrita text-center max-w-[32ch] leading-relaxed">
        Guardado. {nomeSecreto ? `${nomeSecreto} vai lembrar.` : 'Ele vai lembrar.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 self-stretch max-w-md mx-auto w-full">
      <label
        htmlFor="recado"
        className="font-corpo font-light text-sm text-escrita-corpo text-center leading-relaxed"
      >
        Se quiser deixar uma pergunta guardada para quando ele puder responder,
        escreva aqui. Ela fica esperando — ninguém responde agora.
      </label>

      <textarea
        id="recado"
        value={pergunta}
        onChange={(e) => setPergunta(e.target.value.slice(0, LIMITE))}
        rows={4}
        placeholder="O que você perguntaria?"
        className="bg-transparent border border-escrita/25 rounded-xl px-4 py-3 text-escrita placeholder:text-escrita-fraca/60 focus:border-ouro-velho outline-none font-corpo font-light text-sm resize-none"
      />

      <div className="flex items-center justify-between gap-3">
        <span className="font-corpo text-xs text-escrita-fraca tabular-nums">
          {pergunta.length}/{LIMITE}
        </span>
        <button
          onClick={enviar}
          disabled={enviando || !pergunta.trim()}
          className="bg-vela text-tinta font-corpo font-medium text-sm px-6 py-3 rounded-full hover:brightness-110 transition disabled:opacity-40"
        >
          {enviando ? 'Guardando...' : 'Guardar minha pergunta'}
        </button>
      </div>

      {erro && <p className="font-corpo text-sm text-center text-red-700">{erro}</p>}
    </div>
  );
}
