import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { BANCO, DADOS } from './caminhos';

const dataDir = DADOS;
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(BANCO);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    respostas_json TEXT NOT NULL,
    familiar TEXT NOT NULL,
    lua TEXT NOT NULL,
    signo_sol TEXT,
    signo_lua TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    asaas_payment_id TEXT,
    invoice_url TEXT,
    leitura_json TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0,
    criado_em TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS oraculo_espera (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    pergunta TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS eventos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,
    pedido_id TEXT,
    criado_em TEXT NOT NULL
  );
`);

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pago'
  | 'gerando'
  | 'entregue'
  | 'erro';

export interface Pedido {
  id: string;
  nome: string;
  email: string;
  cpf: string | null;
  respostas_json: string;
  familiar: string;
  lua: string;
  signo_sol: string | null;
  signo_lua: string | null;
  status: StatusPedido;
  asaas_payment_id: string | null;
  invoice_url: string | null;
  leitura_json: string | null;
  tentativas: number;
  criado_em: string;
  atualizado_em: string;
}

export function criarPedido(p: {
  id: string;
  nome: string;
  email: string;
  respostas_json: string;
  familiar: string;
  lua: string;
  signo_sol: string;
  signo_lua: string;
}) {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO pedidos
      (id, nome, email, respostas_json, familiar, lua, signo_sol, signo_lua, status, criado_em, atualizado_em)
     VALUES (@id, @nome, @email, @respostas_json, @familiar, @lua, @signo_sol, @signo_lua, 'aguardando_pagamento', @agora, @agora)`
  ).run({ ...p, agora });
}

export function buscarPedido(id: string): Pedido | undefined {
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as
    | Pedido
    | undefined;
}

export function buscarPedidoPorPaymentId(asaasPaymentId: string): Pedido | undefined {
  return db
    .prepare('SELECT * FROM pedidos WHERE asaas_payment_id = ?')
    .get(asaasPaymentId) as Pedido | undefined;
}

export function atualizarPedido(id: string, campos: Partial<Pedido>) {
  const chaves = Object.keys(campos);
  if (chaves.length === 0) return;
  const set = chaves.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE pedidos SET ${set}, atualizado_em = @atualizado_em WHERE id = @id`
  ).run({ ...campos, id, atualizado_em: new Date().toISOString() });
}

export function pedidosTravados(): Pedido[] {
  return db
    .prepare(
      `SELECT * FROM pedidos WHERE status IN ('pago', 'gerando', 'erro') AND tentativas < 3`
    )
    .all() as Pedido[];
}

export function registrarEvento(tipo: string, pedidoId?: string) {
  db.prepare(
    `INSERT INTO eventos (tipo, pedido_id, criado_em) VALUES (?, ?, ?)`
  ).run(tipo, pedidoId ?? null, new Date().toISOString());
}

export function salvarOraculoEspera(id: string, email: string, pergunta: string) {
  db.prepare(
    `INSERT INTO oraculo_espera (id, email, pergunta, criado_em) VALUES (?, ?, ?, ?)`
  ).run(id, email, pergunta, new Date().toISOString());
}

export default db;
