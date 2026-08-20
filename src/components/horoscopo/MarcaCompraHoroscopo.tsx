'use client';

import { useEffect, useRef } from 'react';
import { evento } from '@/lib/pixel';
import { PRECO_HOROSCOPO_CENTAVOS } from '@/lib/horoscopo/pagamento';

/**
 * Dispara `Purchase` uma única vez por pedido.
 *
 * ── Por que este continua no navegador, e o do Bruxário não ───────────────
 *
 * O produto principal passou a contar a venda no servidor, pelo webhook (ver
 * `nucleo/eventos-meta.ts`). Aqui isso não é possível: **o Horóscopo não
 * coleta e-mail**. Sem e-mail o servidor não consegue achar a identidade da
 * pessoa, e o evento sairia sem `fbp`, sem `fbc` e sem nada — pior do que o
 * que já havia, porque perderia a atribuição inteira.
 *
 * ── O `event_id` conserta a parte que dava para consertar ─────────────────
 *
 * A trava é `localStorage`, que é POR NAVEGADOR: a mesma pessoa no app do
 * Instagram, no Chrome do celular e no computador contava três vendas para um
 * pagamento — foi o que aconteceu no produto principal. Com `event_id`
 * estável por pedido, os três disparos viram um só na Meta.
 *
 * Quando o Horóscopo passar a pedir e-mail, este componente sai e o evento vai
 * para o webhook, como o do Bruxário.
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

    evento(
      'Purchase',
      { value: PRECO_HOROSCOPO_CENTAVOS / 100, currency: 'BRL' },
      `${pedidoId}:purchase`
    );
  }, [pedidoId]);

  return null;
}
