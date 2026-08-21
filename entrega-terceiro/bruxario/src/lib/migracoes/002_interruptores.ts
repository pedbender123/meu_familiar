import type { Migracao } from './tipos';

/**
 * Interruptores (feature flags) — disciplina 3 de docs/reestruturacao.md.
 *
 * Todo caminho novo nasce desligado (`ligado = 0`, ninguém em
 * `contas_incluidas`, `percentual = 0`). Liga primeiro só pra uma conta,
 * depois pra uma fatia via `percentual`, depois geral. Desligar de novo é um
 * UPDATE, não um deploy.
 */
const migracao: Migracao = {
  id: '002_interruptores',
  descricao: 'Tabela de interruptores (feature flags)',
  up: (db) => {
    db.exec(`
      CREATE TABLE interruptores (
        chave TEXT PRIMARY KEY,
        ligado INTEGER NOT NULL DEFAULT 0,
        percentual INTEGER NOT NULL DEFAULT 0,
        contas_incluidas TEXT,
        nota TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )
    `);
  },
};

export default migracao;
