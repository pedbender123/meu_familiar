/**
 * Os ids da oferta e o marco de painel de cada um — **sem tocar o banco**.
 *
 * ── Por que isto é um arquivo separado de `oferta.ts` ─────────────────────
 *
 * `OfertaDepoisDoRitual` é componente de cliente e precisa do mapa de marcos
 * para saber o que registrar no clique. Importando de `oferta.ts`, ele
 * arrastava `planos.ts` → `db.ts` → `better-sqlite3` para dentro do pacote do
 * navegador, e o build quebrava — o mesmo tropeço que `CompletarNascimento` já
 * tinha dado com `perfil-astral.ts`.
 *
 * A regra que evita isso: constante que a tela precisa mora numa folha, sem
 * import de servidor. `oferta.ts` re-exporta daqui, então quem já importava de
 * lá continua funcionando.
 */
export const PLANOS_DA_OFERTA = [
  'avulsa_simples',
  'avulsa_completa',
  'revelacao_mensal',
] as const;

export type PlanoDaOfertaId = (typeof PLANOS_DA_OFERTA)[number];

export function ehPlanoDaOferta(id: string): id is PlanoDaOfertaId {
  return (PLANOS_DA_OFERTA as readonly string[]).includes(id);
}

/**
 * O marco de painel de cada degrau.
 *
 * Um plano novo em `PLANOS_DA_OFERTA` sem marco correspondente quebra um teste
 * em vez de simplesmente sumir do relatório. Botão de venda que não é medido é
 * pior que botão que não existe: ele consome tráfego e não aparece em lugar
 * nenhum.
 */
export const MARCO_DO_DEGRAU: Record<PlanoDaOfertaId, string> = {
  avulsa_simples: 'oferta_simples',
  avulsa_completa: 'oferta_completa',
  revelacao_mensal: 'oferta_mensal',
};
