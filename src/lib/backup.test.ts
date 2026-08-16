import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { criarBackup, verificarBackup, restaurarBackup } from './backup';

function pastaTemporaria(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bruxario-backup-'));
}

test('round-trip: backup e restauração preservam até a escrita que só está no -wal', async () => {
  const pasta = pastaTemporaria();
  const origem = path.join(pasta, 'teste.db');
  const pastaBackups = path.join(pasta, 'backups');

  const db = new Database(origem);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE pessoas (id INTEGER PRIMARY KEY, nome TEXT)');
  db.prepare('INSERT INTO pessoas (nome) VALUES (?)').run('Ada');
  db.prepare('INSERT INTO pessoas (nome) VALUES (?)').run('Grace');
  // Sem checkpoint nem close: a segunda linha existe só no -wal neste ponto —
  // é exatamente o caso que uma cópia de arquivo simples perderia.

  const resultado = await criarBackup(origem, pastaBackups);
  assert.equal(verificarBackup(resultado.destino), true);

  db.close();
  fs.rmSync(origem);
  fs.rmSync(`${origem}-wal`, { force: true });
  fs.rmSync(`${origem}-shm`, { force: true });

  restaurarBackup(resultado.destino, origem);

  const restaurado = new Database(origem, { readonly: true });
  const linhas = restaurado
    .prepare('SELECT nome FROM pessoas ORDER BY id')
    .all() as { nome: string }[];
  restaurado.close();

  assert.deepEqual(linhas.map((l) => l.nome), ['Ada', 'Grace']);

  fs.rmSync(pasta, { recursive: true, force: true });
});

test('restaurarBackup guarda o destino anterior como .pre-restauracao', async () => {
  const pasta = pastaTemporaria();
  const origem = path.join(pasta, 'teste.db');
  const pastaBackups = path.join(pasta, 'backups');

  const db = new Database(origem);
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
  db.close();

  const resultado = await criarBackup(origem, pastaBackups);

  fs.writeFileSync(origem, 'estado atual, diferente do backup');

  restaurarBackup(resultado.destino, origem);

  assert.equal(
    fs.readFileSync(`${origem}.pre-restauracao`, 'utf8'),
    'estado atual, diferente do backup'
  );

  fs.rmSync(pasta, { recursive: true, force: true });
});

test('verificarBackup rejeita arquivo que não é SQLite', () => {
  const pasta = pastaTemporaria();
  const falso = path.join(pasta, 'corrompido.db');
  fs.writeFileSync(falso, 'isto não é um banco sqlite');

  assert.equal(verificarBackup(falso), false);

  fs.rmSync(pasta, { recursive: true, force: true });
});

test('verificarBackup rejeita caminho inexistente', () => {
  assert.equal(verificarBackup('/tmp/nao-existe-de-verdade.db'), false);
});

test('restaurarBackup recusa restaurar um backup inválido', () => {
  const pasta = pastaTemporaria();
  const falso = path.join(pasta, 'corrompido.db');
  fs.writeFileSync(falso, 'isto não é um banco sqlite');
  const destino = path.join(pasta, 'destino.db');

  assert.throws(() => restaurarBackup(falso, destino));

  fs.rmSync(pasta, { recursive: true, force: true });
});

test('criarBackup falha alto e claro quando a origem não existe', async () => {
  await assert.rejects(() => criarBackup('/tmp/banco-que-nao-existe.db'));
});
