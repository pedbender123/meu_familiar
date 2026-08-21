'use client';

/**
 * Tema e barra recolhida do painel, guardados no `localStorage`.
 *
 * ── Por que um store externo e não `useState` ─────────────────────────────
 *
 * `localStorage` só existe no navegador. Lê-lo num inicializador de `useState`
 * quebraria a hidratação (o servidor renderiza um valor, o cliente outro), e
 * lê-lo num `useEffect` + `setState` faz o render em cascata que o React 19
 * recusa. `useSyncExternalStore` é exatamente a ferramenta para "estado que
 * mora fora do React": ele pede um valor para o servidor, outro para o
 * cliente, e reassina quando muda.
 */

const EVENTO = 'bx-admin-pref';

export type Tema = 'escuro' | 'claro';

export function assinarPreferencias(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener('storage', aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener('storage', aoMudar);
  };
}

export function lerTema(): Tema {
  try {
    return localStorage.getItem('bx_admin_tema') === 'claro' ? 'claro' : 'escuro';
  } catch {
    return 'escuro';
  }
}

export function lerRecolhida(): boolean {
  try {
    return localStorage.getItem('bx_admin_recolhida') === '1';
  } catch {
    return false;
  }
}

/** O que o servidor devolve. Bate com o padrão do script inline do layout. */
export const TEMA_PADRAO: Tema = 'escuro';
export const RECOLHIDA_PADRAO = false;

export function gravarTema(t: Tema): void {
  try {
    localStorage.setItem('bx_admin_tema', t);
  } catch {
    /* modo privado: o tema vale só para esta aba, e tudo bem */
  }
  // O atributo é a fonte de verdade do CSS; o React só reflete.
  document.querySelector('.admin')?.setAttribute('data-tema', t);
  window.dispatchEvent(new Event(EVENTO));
}

export function gravarRecolhida(v: boolean): void {
  try {
    localStorage.setItem('bx_admin_recolhida', v ? '1' : '0');
  } catch {
    /* idem */
  }
  window.dispatchEvent(new Event(EVENTO));
}
