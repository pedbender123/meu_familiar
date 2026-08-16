'use client';

import { useState } from 'react';
import { Flame } from 'lucide-react';

/** Sem gateway configurado (dev): aprova na hora, sem Brick nenhum. */
export function PagamentoFakeHoroscopo({ pedidoId }: { pedidoId: string }) {
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    setCarregando(true);
    await fetch(`/api/horoscopo/pedido/${pedidoId}/pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formData: { payment_method_id: 'fake' } }),
    });
    window.location.assign(`/horoscopo/revelacao/${pedidoId}`);
  }

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
      <Flame className="text-vela" size={28} strokeWidth={1.5} />
      <h1 className="font-display italic text-2xl text-pergaminho">
        Sem gateway configurado.
      </h1>
      <p className="font-corpo font-light text-sm text-pergaminho/60">
        A compra é aprovada na hora, nada é cobrado.
      </p>
      <button
        onClick={confirmar}
        disabled={carregando}
        className="bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition disabled:opacity-60"
      >
        {carregando ? 'Confirmando...' : 'Confirmar pagamento (teste)'}
      </button>
    </div>
  );
}
