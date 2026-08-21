'use client';

import { useEffect } from 'react';
import type { FunilId } from '@/lib/funis';

/**
 * Conta ao servidor qual funil a raiz decidiu servir, para ele grudar no
 * cookie.
 *
 * ── Por que não gravar direto no render ───────────────────────────────────
 *
 * Componente de servidor não escreve cookie no meio de um render — o Next
 * proíbe, e por bom motivo: a resposta pode estar sendo montada em pedaços e
 * o cabeçalho já ter saído. Só rota e ação podem.
 *
 * ── Por que isso importa ──────────────────────────────────────────────────
 *
 * Sem o cookie, o sorteio do teste A/B roda de novo a cada carregamento: a
 * pessoa começaria num funil, recarregaria e cairia no outro, e o relatório
 * mostraria duas metades de jornada que nunca existiram. Foi exatamente assim
 * que o teste A/B anterior deste projeto mentiu por dias.
 */
export function FunilEscolhido({ funil }: { funil: FunilId }) {
  useEffect(() => {
    // `keepalive` para sobreviver a quem fecha a aba no mesmo instante, e o
    // erro é engolido: perder o carimbo custa um ponto de dado, não a venda.
    fetch('/api/visita', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ caminho: '/', funil, largura: window.innerWidth }),
    }).catch(() => {});
  }, [funil]);

  return null;
}
