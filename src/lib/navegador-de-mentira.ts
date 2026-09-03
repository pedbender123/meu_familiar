/**
 * O mínimo de navegador para testar um módulo de cliente no Node.
 *
 * ── Por que um arquivo só para isto ───────────────────────────────────────
 *
 * `lib/trilha.ts` fala com `window` e `localStorage` na primeira leitura. Num
 * teste, o `import` dele acontece antes de qualquer linha do corpo do arquivo
 * — então o remendo precisa estar num módulo importado ANTES, senão ele chega
 * tarde e o módulo já leu um `window` que não existe.
 *
 * Não é um DOM: é um armário com três gavetas e um mural de recados. O que se
 * quer testar é a lógica (a roda das faixas, o pedido do capítulo, o abrir e
 * fechar), e para isso um navegador de verdade seria peso morto.
 */

const guardado = new Map<string, string>();
const ouvintes = new Map<string, Set<() => void>>();

/** Esquece o que foi guardado — para o `beforeEach` de quem usa. */
export function limparNavegadorDeMentira(): void {
  guardado.clear();
}

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => guardado.get(k) ?? null,
    setItem: (k: string, v: string) => void guardado.set(k, v),
    removeItem: (k: string) => void guardado.delete(k),
  },
  addEventListener: (nome: string, fn: () => void) => {
    if (!ouvintes.has(nome)) ouvintes.set(nome, new Set());
    ouvintes.get(nome)!.add(fn);
  },
  removeEventListener: (nome: string, fn: () => void) => {
    ouvintes.get(nome)?.delete(fn);
  },
  dispatchEvent: (ev: { type: string }) => {
    ouvintes.get(ev.type)?.forEach((fn) => fn());
    return true;
  },
};

(globalThis as unknown as { Event: unknown }).Event = class {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
};
