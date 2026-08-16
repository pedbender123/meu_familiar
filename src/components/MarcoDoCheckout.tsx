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
 */
export function MarcoDoCheckout({ valorEmReais }: { valorEmReais?: number }) {
  const marcou = useRef(false);
  useEffect(() => {
    if (marcou.current) return;
    marcou.current = true;
    marcar('checkout_aberto');
    evento('InitiateCheckout', { value: valorEmReais, currency: 'BRL' });
  }, [valorEmReais]);
  return null;
}
