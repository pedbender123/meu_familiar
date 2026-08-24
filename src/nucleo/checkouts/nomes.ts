/**
 * Os nomes dos gateways, e nada mais.
 *
 * ── Por que um arquivo só para isto ───────────────────────────────────────
 *
 * `gateway.ts` decide QUEM cobra, e para isso lê a campanha no banco — o que
 * arrasta `better-sqlite3` junto. O seletor do painel é componente de
 * cliente e precisa só da LISTA de nomes; importar de lá levava o driver do
 * SQLite para dentro do bundle do navegador, e o build quebrava em
 * `Can't resolve 'fs'`.
 *
 * Separar o vocabulário da decisão resolve, e é a divisão certa de qualquer
 * forma: a lista de gateways é um fato do domínio, não uma regra de negócio.
 */

export type NomeDoGateway = 'mercadopago' | 'cakto' | 'wiven';

export const NOMES_DE_GATEWAY: readonly NomeDoGateway[] = ['mercadopago', 'cakto', 'wiven'];

/** Para o painel validar o que veio do formulário antes de gravar. */
export function ehGateway(v: unknown): v is NomeDoGateway {
  return typeof v === 'string' && (NOMES_DE_GATEWAY as readonly string[]).includes(v);
}

/** Como cada gateway se chama para quem está olhando o painel. */
export const ROTULO_DO_GATEWAY: Record<NomeDoGateway, string> = {
  mercadopago: 'Mercado Pago',
  cakto: 'Cakto',
  wiven: 'Wiven',
};
