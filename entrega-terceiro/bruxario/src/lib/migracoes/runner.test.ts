import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { executarMigracoes, historicoDeMigracoes } from './runner';
import type { Migracao } from './tipos';

function bancoDeTeste() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  return db;
}

test('aplica migrações pendentes em ordem e marca cada uma', () => {
  const db = bancoDeTeste();
  const ordem: string[] = [];

  const lista: Migracao[] = [
    { id: '001_a', descricao: 'a', up: () => ordem.push('a') },
    { id: '002_b', descricao: 'b', up: () => ordem.push('b') },
    { id: '003_c', descricao: 'c', up: () => ordem.push('c') },
  ];

  const resultado = executarMigracoes(db, lista);

  assert.deepEqual(resultado.aplicadas, ['001_a', '002_b', '003_c']);
  assert.deepEqual(ordem, ['a', 'b', 'c']);

  const historico = historicoDeMigracoes(db);
  assert.deepEqual(
    historico.map((h) => h.id),
    ['001_a', '002_b', '003_c']
  );
});

test('idempotente: rodar de novo não reaplica nem rechama up()', () => {
  const db = bancoDeTeste();
  let chamadas = 0;

  const lista: Migracao[] = [
    { id: '001_a', descricao: 'a', up: () => { chamadas++; } },
  ];

  executarMigracoes(db, lista);
  assert.equal(chamadas, 1);

  const segunda = executarMigracoes(db, lista);
  assert.equal(chamadas, 1);
  assert.deepEqual(segunda.aplicadas, []);
});

test('só roda o que é novo quando a lista cresce entre chamadas', () => {
  const db = bancoDeTeste();
  const lista: Migracao[] = [
    { id: '001_a', descricao: 'a', up: () => {} },
  ];
  executarMigracoes(db, lista);

  let rodouB = false;
  const listaMaior: Migracao[] = [
    ...lista,
    { id: '002_b', descricao: 'b', up: () => { rodouB = true; } },
  ];
  const resultado = executarMigracoes(db, listaMaior);

  assert.equal(rodouB, true);
  assert.deepEqual(resultado.aplicadas, ['002_b']);
});

test('migração que lança desfaz o up() inteiro — nada fica meio-aplicado', () => {
  const db = bancoDeTeste();
  db.exec('CREATE TABLE alvo (id INTEGER PRIMARY KEY)');

  const lista: Migracao[] = [
    {
      id: '001_falha',
      descricao: 'insere e então quebra',
      up: (db) => {
        db.prepare('INSERT INTO alvo (id) VALUES (1)').run();
        throw new Error('algo deu errado no meio da migração');
      },
    },
  ];

  assert.throws(() => executarMigracoes(db, lista), /algo deu errado/);

  const linhas = db.prepare('SELECT * FROM alvo').all();
  assert.deepEqual(linhas, [], 'o INSERT deveria ter sido desfeito junto com a falha');

  const historico = historicoDeMigracoes(db);
  assert.deepEqual(historico, [], 'nada deveria estar marcado como aplicada');
});

test('uma migração real: cria tabela e coluna, do jeito que 002 em diante vai fazer', () => {
  const db = bancoDeTeste();

  const migracao: Migracao = {
    id: '002_planos',
    descricao: 'catálogo de planos',
    up: (db) => {
      db.exec(`
        CREATE TABLE planos (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          preco_centavos INTEGER NOT NULL
        )
      `);
      db.prepare(
        'INSERT INTO planos (id, nome, preco_centavos) VALUES (?, ?, ?)'
      ).run('revelacao', 'Revelação', 1490);
    },
  };

  executarMigracoes(db, [migracao]);

  const planos = db.prepare('SELECT * FROM planos').all();
  assert.deepEqual(planos, [
    { id: 'revelacao', nome: 'Revelação', preco_centavos: 1490 },
  ]);
});
