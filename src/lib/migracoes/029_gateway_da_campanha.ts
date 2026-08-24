import type { Migracao } from './tipos';

/**
 * Em qual conta o dinheiro desta campanha cai.
 *
 * ── Por que na campanha, e não no `.env` ──────────────────────────────────
 *
 * Duas campanhas rodando ao mesmo tempo podem precisar cair em contas
 * diferentes — a do dono numa, a da agência noutra. A primeira tentativa foi
 * uma variável de ambiente casando o nome da campanha por texto, e ela era
 * frágil de dois jeitos: dependia de o link do anúncio carregar
 * `utm_campaign` (o da Meta carrega o ID numérico, não o nome), e mudar a
 * regra exigia entrar na VPS.
 *
 * A campanha já existe como registro, já tem código próprio na URL (`?c=`),
 * e o pedido já guarda `campanha_id` desde que nasce. A informação estava
 * toda aqui — faltava a coluna.
 *
 * Escolher o checkout passa a ser igual a escolher a página de vendas: um
 * campo no formulário da campanha, no painel, sem deploy e sem restart.
 *
 * ── `NULL` significa "o padrão" ───────────────────────────────────────────
 *
 * Toda campanha antiga fica `NULL`, e `NULL` cai em `GATEWAY`. É o
 * comportamento que elas já tinham — nenhuma campanha muda de conta por
 * causa desta migração.
 */
const migracao: Migracao = {
  id: '029_gateway_da_campanha',
  descricao: 'Qual checkout cobra as vendas de cada campanha',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(campanhas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('gateway')) {
      db.exec(`ALTER TABLE campanhas ADD COLUMN gateway TEXT`);
    }
  },
};

export default migracao;
