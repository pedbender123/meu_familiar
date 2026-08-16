import type Database from 'better-sqlite3';

export interface Migracao {
  /** Prefixo numérico + nome curto, ex. `002_planos`. Nunca reordena, nunca reusa. */
  id: string;
  descricao: string;
  /** Roda dentro de uma transação — lançar aqui desfaz tudo, inclusive a marca de aplicada. */
  up: (db: Database.Database) => void;
}
