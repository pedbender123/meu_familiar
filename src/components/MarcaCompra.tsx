'use client';

import { useEffect, useRef } from 'react';
import { evento } from '@/lib/pixel';

/**
 * Dispara `Purchase` uma única vez por pedido.
 *
 * ── Por que a trava em `localStorage`, e não só o `useRef` ───────────────
 *
 * `/revelacao/[id]` é permanente — a dona volta a ela quantas vezes quiser,
 * inclusive dias depois, para reler ou mostrar para alguém. Sem uma trava que
 * sobrevive a um recarregamento de página, cada visita reportaria uma nova
 * compra para o Ads Manager e inflaria o valor de conversão real.
 */
export function MarcaCompra({
  pedidoId,
  valorEmReais,
}: {
  pedidoId: string;
  valorEmReais: number;
}) {
  const disparou = useRef(false);
  useEffect(() => {
    if (disparou.current) return;
    disparou.current = true;

    const chave = `bx_compra_${pedidoId}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch {
      // Sem storage (modo privado, etc.): melhor arriscar contar de novo do
      // que nunca contar a compra.
    }

    evento('Purchase', { value: valorEmReais, currency: 'BRL' });
  }, [pedidoId, valorEmReais]);

  return null;
}
