import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Banco PRÓPRIO, arquivo próprio (`var/data/horoscopo.db`) — de propósito
 * separado de `bruxario.db`. O Horóscopo não é o mesmo produto: não tem
 * conta, não tem painel, não alimenta o resto da plataforma. Um arquivo à
 * parte deixa isso literal, não só uma tabela isolada no mesmo banco: dá
 * pra fazer backup, migrar ou apagar um sem tocar no outro.
 */
const RAIZ = process.cwd();
const DADOS = path.join(RAIZ, 'var', 'data');
const BANCO = path.join(DADOS, 'horoscopo.db');

if (!fs.existsSync(DADOS)) fs.mkdirSync(DADOS, { recursive: true });

const db = new Database(BANCO);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos_horoscopo (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    data_nascimento TEXT NOT NULL,
    signo_sol TEXT NOT NULL,
    signo_lua TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    pagamento_id TEXT,
    leitura_json TEXT,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );
`);

export interface PedidoHoroscopo {
  id: string;
  nome: string;
  data_nascimento: string;
  signo_sol: string;
  signo_lua: string;
  status: string;
  pagamento_id: string | null;
  leitura_json: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function criarPedidoHoroscopo(dados: {
  id: string;
  nome: string;
  data_nascimento: string;
  signo_sol: string;
  signo_lua: string;
}): void {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO pedidos_horoscopo
       (id, nome, data_nascimento, signo_sol, signo_lua, criado_em, atualizado_em)
     VALUES (@id, @nome, @data_nascimento, @signo_sol, @signo_lua, @criado_em, @atualizado_em)`
  ).run({ ...dados, criado_em: agora, atualizado_em: agora });
}

export function buscarPedidoHoroscopo(id: string): PedidoHoroscopo | undefined {
  return db
    .prepare('SELECT * FROM pedidos_horoscopo WHERE id = ?')
    .get(id) as PedidoHoroscopo | undefined;
}

export function buscarPedidoHoroscopoPorPagamentoId(
  pagamentoId: string
): PedidoHoroscopo | undefined {
  return db
    .prepare('SELECT * FROM pedidos_horoscopo WHERE pagamento_id = ?')
    .get(pagamentoId) as PedidoHoroscopo | undefined;
}

export function atualizarPedidoHoroscopo(
  id: string,
  campos: Partial<Omit<PedidoHoroscopo, 'id' | 'criado_em'>>
): void {
  const chaves = Object.keys(campos);
  if (chaves.length === 0) return;
  const set = chaves.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE pedidos_horoscopo SET ${set}, atualizado_em = @atualizado_em WHERE id = @id`
  ).run({ ...campos, atualizado_em: new Date().toISOString(), id });
}

export default db;
