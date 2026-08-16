declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Dispara um evento padrão do Pixel da Meta, se ele estiver carregado.
 *
 * ── Por que evento padrão, e não nome livre ───────────────────────────────
 *
 * `Lead`, `InitiateCheckout`, `Purchase` etc. são os nomes que o Ads Manager
 * já entende para otimizar entrega — um nome inventado vira só um número sem
 * uso na coluna "eventos personalizados". O rastreio DELES (qual funil, qual
 * campanha) já é feito pelo nosso sistema; o pixel aqui existe só para
 * alimentar o algoritmo de anúncio, então participa do mesmo funil de
 * conversão não importa qual página de vendas a pessoa viu.
 *
 * ── Por que a guarda de `window.fbq` ──────────────────────────────────────
 *
 * Sem `NEXT_PUBLIC_META_PIXEL_ID` configurado (dev, ou enquanto a chave não
 * chega), o script base nunca é injetado — chamar `fbq` quebraria a página
 * para todo mundo em vez de só deixar de contar um evento.
 */
export function evento(nome: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  try {
    window.fbq('track', nome, params);
  } catch {
    /* telemetria nunca quebra a página */
  }
}
