import type { Migracao } from './tipos';

/**
 * A tabela da Sentinela (docs/reestruturacao.md §5). Uma linha por invariante
 * violada — `esperado`/`encontrado` em texto legível é o que faz a tela
 * servir às 3 da manhã sem precisar decifrar um JSON.
 */
const migracao: Migracao = {
  id: '003_anomalias',
  descricao: 'Tabela de anomalias — registro da Sentinela',
  up: (db) => {
    db.exec(`
      CREATE TABLE anomalias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ocorrido_em TEXT NOT NULL,
        invariante TEXT NOT NULL,
        severidade TEXT NOT NULL,
        entidade_tipo TEXT NOT NULL,
        entidade_id TEXT NOT NULL,
        esperado TEXT NOT NULL,
        encontrado TEXT NOT NULL,
        contexto_json TEXT,
        resolvido_em TEXT,
        resolucao TEXT,
        falso_positivo INTEGER NOT NULL DEFAULT 0
      )
    `);
    db.exec(`CREATE INDEX idx_anomalias_abertas ON anomalias (resolvido_em, severidade, ocorrido_em)`);
    db.exec(`CREATE INDEX idx_anomalias_invariante ON anomalias (invariante, ocorrido_em)`);
    db.exec(`CREATE INDEX idx_anomalias_entidade ON anomalias (entidade_tipo, entidade_id)`);
  },
};

export default migracao;
