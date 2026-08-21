import type { Marco } from './analitica';

/**
 * Avisa o servidor que a pessoa deu um passo.
 *
 * Dispara e esquece: nunca aguardado, nunca bloqueia interface, e o erro é
 * engolido de propósito. Uma medição perdida vale menos que meio segundo de
 * atraso na tela de quem está comprando.
 *
 * `keepalive` faz a requisição sobreviver a quem fecha a aba no mesmo
 * instante — que é exatamente quem mais interessa medir, já que é a pessoa
 * que está desistindo.
 */
export function marcar(marco: Marco, valor?: number): void {
  if (typeof window === 'undefined') return;
  try {
    fetch('/api/marco', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ marco, valor }),
    }).catch(() => {});
  } catch {
    /* telemetria nunca quebra a página */
  }
}
