'use client';

import { useEffect, useRef } from 'react';
import { marcar } from '@/lib/marcar';
import { evento } from '@/lib/pixel';

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
export function MarcoDoCheckout({
  pedidoId,
  valorEmReais,
}: {
  pedidoId: string;
  valorEmReais?: number;
}) {
  const marcou = useRef(false);
  useEffect(() => {
    if (marcou.current) return;
    marcou.current = true;
    marcar('checkout_aberto');
    /*
      O `event_id` faz este disparo e o que o servidor enfileira serem o mesmo
      acontecimento. Enquanto não houver token de Conversions API, só este sai
      — e é ele que mantém a medição de pé.
    */
    evento('InitiateCheckout', { value: valorEmReais, currency: 'BRL' }, `${pedidoId}:checkout`);
  }, [pedidoId, valorEmReais]);
  return null;
}
