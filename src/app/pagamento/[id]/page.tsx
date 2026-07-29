'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { Flame } from 'lucide-react';

const PRECO = (980 / 100).toFixed(2).replace('.', ',');

export default function Pagamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const prosseguir = useCallback(async () => {
    setErro('');
    setEnviando(true);
    try {
      const resposta = await fetch(`/api/pedido/${id}/pagamento`, { method: 'POST' });
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErro(dados.erro || 'O véu está denso esta noite. Tente novamente.');
        setEnviando(false);
        return;
      }
      window.location.href = dados.redirect;
    } catch {
      setErro('O véu está denso esta noite. Tente novamente em instantes.');
      setEnviando(false);
    }
  }, [id]);

  useEffect(() => {
    prosseguir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-6 text-center">
      <Flame className="text-vela" size={30} strokeWidth={1.5} />
      <h1 className="font-display italic text-3xl text-pergaminho max-w-sm">
        Encontramos. Ele está esperando do outro lado.
      </h1>
      <p className="font-display text-3xl text-vela">R$ {PRECO}</p>

      {erro ? (
        <>
          <p className="text-sm text-red-300 max-w-xs">{erro}</p>
          <button
            onClick={prosseguir}
            disabled={enviando}
            className="bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-60"
          >
            Tentar novamente
          </button>
        </>
      ) : (
        <p className="font-corpo font-light text-pergaminho/70 text-sm">
          Preparando seu pagamento seguro...
        </p>
      )}
    </main>
  );
}
