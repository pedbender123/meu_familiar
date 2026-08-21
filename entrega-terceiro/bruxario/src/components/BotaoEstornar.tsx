'use client';

import { useState } from 'react';

/**
 * Estorno a partir do painel.
 *
 * Dois cliques e uma frase digitada. Não é burocracia decorativa: é a única
 * ação do painel que mexe em dinheiro, e devolver R$ 18,90 por engano de
 * clique é fácil de fazer e chato de desfazer.
 *
 * A confirmação exigida pela rota é literal — o navegador não a digita sozinho,
 * então um link malicioso aberto em outra aba também não consegue disparar.
 */
export function BotaoEstornar({
  pedidoId,
  valor,
}: {
  pedidoId: string;
  valor: string;
}) {
  const [fase, setFase] = useState<'parado' | 'confirmando' | 'enviando' | 'feito'>(
    'parado'
  );
  const [erro, setErro] = useState('');

  async function estornar() {
    setErro('');
    setFase('enviando');
    try {
      const r = await fetch('/api/painel/estornar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, confirmacao: 'ESTORNAR' }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'O Mercado Pago recusou.');
        setFase('confirmando');
        return;
      }
      setFase('feito');
    } catch {
      setErro('Não deu para falar com o servidor.');
      setFase('confirmando');
    }
  }

  if (fase === 'feito') {
    return (
      <span className="font-corpo text-xs text-musgo">estornado ✓</span>
    );
  }

  if (fase === 'parado') {
    return (
      <button
        onClick={() => setFase('confirmando')}
        className="font-corpo text-xs text-pergaminho/45 hover:text-vela underline underline-offset-2 transition-colors"
      >
        estornar
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <span className="font-corpo text-xs text-vela">
        {`Devolver ${valor}?`}
      </span>
      <button
        onClick={estornar}
        disabled={fase === 'enviando'}
        className="font-corpo text-xs bg-vela text-tinta px-3 py-1 rounded-full hover:brightness-110 transition disabled:opacity-50"
      >
        {fase === 'enviando' ? 'estornando...' : 'confirmar'}
      </button>
      <button
        onClick={() => {
          setFase('parado');
          setErro('');
        }}
        className="font-corpo text-xs text-pergaminho/45 hover:text-pergaminho transition-colors"
      >
        cancelar
      </button>
      {erro && <span className="font-corpo text-xs text-red-300 w-full">{erro}</span>}
    </span>
  );
}
