'use client';

import { useEffect, useRef } from 'react';
import { marcar } from '@/lib/marcar';

/**
 * Marca que a tela de pagamento apareceu de verdade.
 *
 * `pagamento_aberto` dispara no clique do plano, antes do redirecionamento —
 * ele mede intenção, não chegada. A diferença entre os dois é gente que
 * clicou em "quero" e não viu o checkout: erro de rede, desistência no meio
 * do carregamento, Brick que não montou. Era o único degrau do funil sem
 * nenhuma medição.
 *
 * O mesmo instante alimenta o `InitiateCheckout` do Pixel, com o valor real
 * já com cupom aplicado — é o que deixa o Ads Manager otimizar por valor, não
 * só por contagem de evento.
 *
 * `eventId` segue a convenção de `scripts/backfill-pixel.ts`
 * (`${pedidoId}:checkout`) — é o que permite este disparo do navegador e um
 * futuro envio via Conversions API do MESMO evento serem deduplicados pela
 * Meta em vez de contados duas vezes (ver o comentário em `lib/pixel.ts`).
 */
export function MarcoDoCheckout({ pedidoId }: { pedidoId: string }) {
  const marcou = useRef(false);
  useEffect(() => {
    if (marcou.current) return;
    marcou.current = true;
    marcar('checkout_aberto');
    /*
      `InitiateCheckout` NÃO sai daqui.

      No navegador ele dependia desta tela montar: sumia para quem tem
      bloqueador e contava de novo a cada recarga. Agora sai do servidor, no
      momento em que a cobrança é criada — que é quando a intenção existe de
      verdade. Ver `nucleo/eventos-meta.ts`.

      O marco acima continua: ele é do NOSSO painel, não da Meta, e medir a
      tela renderizada é justamente o que ele existe para fazer.
    */
  }, [pedidoId]);
  return null;
}
