import type { Migracao } from './tipos';

/**
 * O guia semanal, guardado — não só enviado.
 *
 * ── Por que a tabela existe, se o guia vai por e-mail ─────────────────────
 *
 * Porque e-mail se perde, e o que a pessoa paga não pode morar só na caixa de
 * entrada dela. O direito `guiaPorEmail` descreve o ALCANCE (o pago vai atrás
 * da pessoa, o grátis espera ela entrar), não o lugar onde a coisa vive — e
 * um guia que só existe no e-mail some quando alguém troca de provedor.
 *
 * ── E porque ele custa dinheiro ───────────────────────────────────────────
 *
 * É uma chamada de IA por pessoa por semana. Sem guardar, um cron que rode
 * duas vezes por engano gera duas — e a segunda é dinheiro queimado numa coisa
 * que já existia. A chave `(conta_id, semana)` faz o banco recusar a
 * duplicata em vez de o script precisar lembrar de conferir.
 *
 * `custo_centavos` fica junto desde a primeira linha, como nas leituras: a
 * margem por plano é métrica de produto aqui, não curiosidade de fim de mês —
 * e o guia é a única entrega recorrente cujo custo cresce com a base.
 */
const migracao: Migracao = {
  id: '023_guias_semanais',
  descricao: 'Guia semanal guardado, com a semana como chave de unicidade',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS guias_semanais (
        id         TEXT PRIMARY KEY,
        conta_id   TEXT NOT NULL,
        -- YYYY-MM-DD da segunda-feira que abre a semana.
        semana     TEXT NOT NULL,
        corpo_json TEXT NOT NULL,
        modelo     TEXT,
        custo_centavos INTEGER NOT NULL DEFAULT 0,
        tokens_entrada INTEGER NOT NULL DEFAULT 0,
        tokens_saida   INTEGER NOT NULL DEFAULT 0,
        enviado_em TEXT,
        criado_em  TEXT NOT NULL,
        UNIQUE (conta_id, semana)
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_guias_conta ON guias_semanais (conta_id, semana DESC)`
    );
  },
};

export default migracao;
