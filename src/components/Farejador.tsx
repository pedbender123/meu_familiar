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
      }),
    }).catch(() => {});
  }, [caminho, busca]);

  return null;
}
