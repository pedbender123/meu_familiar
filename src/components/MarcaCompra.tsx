'use client';

import { useEffect, useRef } from 'react';
import { evento } from '@/lib/pixel';

/**
 * Dispara `Purchase` no navegador — **uma vez por venda, não por navegador**.
 *
 * ── O que estava errado, e qual era o conserto ────────────────────────────
 *
 * Em produção o mesmo pagamento virava três vendas no Ads Manager: `/obrigado`
 * disparava um, esta tela disparava outro, e a trava dos dois era
 * `localStorage`, que é POR NAVEGADOR. Quem pagava no app do Instagram, abria
 * o e-mail no Chrome e depois olhava no computador tinha três memórias
 * diferentes e contava três vezes.
 *
 * O conserto é `event_id`, e é só isso: com um id estável por pedido, os três
 * disparos chegam à Meta como o MESMO acontecimento e ela conta um. A trava
 * de `localStorage` continua, mas deixou de ser o que segura a contagem —
 * agora ela só evita tráfego inútil.
 *
 * ── Por que continua no navegador ─────────────────────────────────────────
 *
 * Porque o caminho de servidor (Conversions API) exige um token de acesso que
 * a conta não tem. Enquanto ele não existir, tirar o disparo daqui não
 * "melhora a arquitetura": apaga a medição inteira.
 *
 * O servidor também enfileira este mesmo evento, com o MESMO `event_id` (ver
 * `nucleo/eventos-meta.ts`). No dia em que o token existir, os dois convivem e
 * a Meta continua contando um — e aí este componente pode sair sem que nada
 * pare de ser medido.
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
      // Sem storage (aba anônima, etc.): dispara mesmo assim. O `event_id`
      // é quem impede a contagem dobrada, não esta trava.
    }

    evento('Purchase', { value: valorEmReais, currency: 'BRL' }, `${pedidoId}:purchase`);
  }, [pedidoId, valorEmReais]);

  return null;
}
