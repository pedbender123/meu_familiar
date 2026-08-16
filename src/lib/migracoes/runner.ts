import type Database from 'better-sqlite3';
import type { Migracao } from './tipos';
import { MIGRACOES } from './registro';

function garantirTabela(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migracoes (
      id TEXT PRIMARY KEY,
      aplicada_em TEXT NOT NULL
    )
  `);
}

function idsAplicados(db: Database.Database): Set<string> {
  const linhas = db.prepare('SELECT id FROM migracoes').all() as { id: string }[];
  return new Set(linhas.map((l) => l.id));
}

export interface ResultadoMigracoes {
  aplicadas: string[];
}

/**
 * Roda as migrações pendentes, em ordem, cada uma na sua transação.
 *
 * Idempotente e tolerante a **concorrência**, não só a repetição: o `next
 * build` sobe vários workers, cada um importa `db.ts`, e todos chegam aqui
 * perto do mesmo instante. A marca de "aplicada" é gravada DENTRO da mesma
 * transação do `up()` — então um worker que perde a corrida encontra a
 * migração já marcada e simplesmente pula, nunca aplica duas vezes e nunca
 * fica com o `up()` rodado sem a marca (ou o contrário).
 *
 * Se `up()` lançar, a transação inteira desfaz — a migração não fica
 * meio-aplicada, e a próxima chamada tenta de novo do zero.
 */
export function executarMigracoes(
  db: Database.Database,
  lista: Migracao[] = MIGRACOES
): ResultadoMigracoes {
  garantirTabela(db);
  const jaAplicadas = idsAplicados(db);
  const aplicadas: string[] = [];

  for (const migracao of lista) {
    if (jaAplicadas.has(migracao.id)) continue;

    const rodar = db.transaction(() => {
      // Reconfere DENTRO da transação: fecha a janela entre o SELECT lá em
      // cima e aqui, caso outro processo tenha aplicado nesse meio-tempo.
      const existe = db
        .prepare('SELECT 1 FROM migracoes WHERE id = ?')
        .get(migracao.id);
      if (existe) return;

      migracao.up(db);
      db.prepare('INSERT INTO migracoes (id, aplicada_em) VALUES (?, ?)').run(
        migracao.id,
        new Date().toISOString()
      );
    });

    try {
      rodar();
      aplicadas.push(migracao.id);
    } catch (erro) {
      // Outro processo segurou o lock aplicando a MESMA migração agora —
      // esperado sob concorrência, não é falha desta chamada.
      if (erro instanceof Error && /database is locked/i.test(erro.message)) {
        continue;
      }
      throw erro;
    }
  }

  return { aplicadas };
}

/** Para telas e scripts que precisam mostrar o que já rodou e quando. */
export function historicoDeMigracoes(
  db: Database.Database
): { id: string; aplicada_em: string }[] {
  garantirTabela(db);
  return db
    .prepare('SELECT id, aplicada_em FROM migracoes ORDER BY aplicada_em ASC')
    .all() as { id: string; aplicada_em: string }[];
}
