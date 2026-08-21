/**
 * A identidade da loja, num lugar só.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────
 *
 * O domínio, o @ e o nome estavam escritos à mão dentro da arte, do rodapé e
 * do CAPI. Quem assumir a operação precisaria caçar cada um — e o que escapa
 * fica: uma arte que ninguém revisa continua imprimindo o @ de outra pessoa
 * na imagem que o cliente publica.
 *
 * Tudo vem do ambiente, com um valor de exemplo óbvio o bastante para
 * denunciar que não foi configurado.
 */
export const MARCA = {
  nome: process.env.NEXT_PUBLIC_MARCA_NOME ?? 'Bruxário',
  dominio: process.env.NEXT_PUBLIC_MARCA_DOMINIO ?? 'exemplo.com.br',
  /** Sem `@`. Vazio esconde os links de rede social em vez de mostrá-los quebrados. */
  arroba: process.env.NEXT_PUBLIC_MARCA_ARROBA ?? '',
} as const;

export function urlBase(): string {
  return process.env.BASE_URL ?? `https://${MARCA.dominio}`;
}
