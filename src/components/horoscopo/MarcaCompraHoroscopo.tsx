'use client';

import { useEffect, useRef } from 'react';
import { evento } from '@/lib/pixel';
import { PRECO_HOROSCOPO_CENTAVOS } from '@/lib/horoscopo/pagamento';

/**
 * Dispara `Purchase` uma única vez por pedido — mesmo padrão de
 * `MarcaCompra.tsx` do produto principal, trava em `localStorage` porque a
 * pessoa pode voltar a esta URL depois.
 */
export function MarcaCompraHoroscopo({ pedidoId }: { pedidoId: string }) {
  const disparou = useRef(false);

  useEffect(() => {
    if (disparou.current) return;
    disparou.current = true;

    const chave = `bx_horoscopo_compra_${pedidoId}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch {
      // sem storage: melhor arriscar contar de novo do que nunca contar
    }

    evento('Purchase', { value: PRECO_HOROSCOPO_CENTAVOS / 100, currency: 'BRL' });
  }, [pedidoId]);

  return null;
}
