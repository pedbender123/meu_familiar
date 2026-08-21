'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Avisa o servidor que uma página foi vista.
 *
 * ── Por que o `useRef` com o último caminho ───────────────────────────────
 *
 * Em React 18+ com Strict Mode, todo efeito roda duas vezes em
 * desenvolvimento. Sem a guarda, cada página contaria duas visitas em dev e o
 * número no painel seria diferente do de produção — o tipo de discrepância que
 * faz alguém passar uma tarde caçando um bug que não existe.
 *
 * ── Por que não bloqueia nada ─────────────────────────────────────────────
 *
 * O `fetch` é disparado e esquecido, com `keepalive` para sobreviver a quem
 * fecha a aba no mesmo instante. Se a rota cair, o `catch` vazio engole: uma
 * contagem perdida não vale um erro no console de quem está comprando.
 */
export function Farejador() {
  const caminho = usePathname();
  const busca = useSearchParams();
  const ultimo = useRef<string | null>(null);

  useEffect(() => {
    if (!caminho || ultimo.current === caminho) return;
    ultimo.current = caminho;

    fetch('/api/visita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        caminho,
        // Os quatro marcadores de rastreio, cru. Quem decide o que cada um
        // significa é `lib/rastreio.ts`, no servidor — aqui só transporta.
        de: busca.get('de') ?? busca.get('utm_source') ?? undefined,
        c: busca.get('c') ?? undefined,
        s: busca.get('s') ?? undefined,
        e: busca.get('e') ?? undefined,
        referencia: document.referrer || undefined,
        largura: window.innerWidth,
        /**
         * A URL COMPLETA, com query inteira.
         *
         * `caminho` é cortado na `?` de propósito — ele vai para `visitas`,
         * que é relatório de navegação. Esta aqui vai para `identidades` e
         * responde outra pergunta: "de qual link exatamente essa pessoa
         * veio?". Sem a query inteira não dá para saber qual criativo, qual
         * variação de copy, qual teste — que é justamente o que se quer saber
         * de quem chegou por anúncio.
         */
        url: window.location.href,
        // `_fbp` e `_fbc` NÃO viajam aqui: são cookies de primeira parte e o
        // servidor já os recebe no header `Cookie`. O `fbclid` vem na URL e
        // existe antes de o pixel criar o `_fbc` — em navegador com
        // bloqueador, é a única pista de qual anúncio trouxe a pessoa.
        fbclid: busca.get('fbclid') ?? undefined,
      }),
    }).catch(() => {});
  }, [caminho, busca]);

  return null;
}
