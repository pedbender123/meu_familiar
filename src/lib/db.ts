import Database from 'better-sqlite3';
import fs from 'fs';
import { BANCO, DADOS } from './caminhos';
import { PRODUTO_PADRAO, type ProdutoId } from './produtos';

if (!fs.existsSync(DADOS)) fs.mkdirSync(DADOS, { recursive: true });

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
    produto TEXT NOT NULL DEFAULT '${PRODUTO_PADRAO}',
    status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
    pagamento_id TEXT,
    pix_copia_e_cola TEXT,
    perfil_json TEXT,
    desempatado_pela_pessoa INTEGER NOT NULL DEFAULT 0,
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

  -- SPEC 0.8: "desafios como entidade no banco, mesmo vazia". Nasce sem uso e
  -- é isso mesmo — o crescimento é a Parte VI e está fora do v1. Existe agora
  -- porque criar a tabela depois é fácil, mas RECONSTRUIR o histórico que ela
  -- deveria ter acumulado é impossível.
  CREATE TABLE IF NOT EXISTS desafios (
    id TEXT PRIMARY KEY,
    pedido_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    origem TEXT NOT NULL,
    superado_em TEXT,
    criado_em TEXT NOT NULL
  );
`);

/**
 * Migração idempotente. O schema acima só vale para banco novo — o que já
 * existe na VPS foi criado na época do Asaas, com `asaas_payment_id` e
 * `invoice_url` e sem coluna de produto. Roda a cada boot: barato, e evita um
 * passo manual de deploy que alguém esquece.
 *
 * Precisa tolerar **concorrência**, não só repetição: o `next build` sobe vários
 * workers, cada um importa este módulo, e todos leem o schema antes de qualquer
 * um escrever. Sem isso o segundo worker morre com "duplicate column name" e o
 * build inteiro falha — foi exatamente o que aconteceu.
 */
function adicionarColunaSeFaltar(coluna: string, tipo: string): boolean {
  try {
    db.exec(`ALTER TABLE pedidos ADD COLUMN ${coluna} ${tipo}`);
    return true;
  } catch (erro) {
    // Outro processo chegou primeiro (ou a coluna já existia): é sucesso, não
    // falha. Qualquer outro erro de SQL continua subindo.
    if (erro instanceof Error && /duplicate column name/i.test(erro.message)) {
      return false;
    }
    throw erro;
  }
}

function garantirColunas() {
  const colunasAntigas = new Set(
    (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    )
  );

  adicionarColunaSeFaltar('produto', `TEXT NOT NULL DEFAULT '${PRODUTO_PADRAO}'`);
  const pagamentoIdNasceuAgora = adicionarColunaSeFaltar('pagamento_id', 'TEXT');
  adicionarColunaSeFaltar('pix_copia_e_cola', 'TEXT');
  // SPEC 0.8, travado: os 12 escores salvos, não só o vencedor. É barato agora
  // e evita ter que refazer o quiz de todo mundo quando a roda dos 12 e o
  // crescimento (Parte VI) precisarem do dado.
  adicionarColunaSeFaltar('perfil_json', 'TEXT');
  adicionarColunaSeFaltar('desempatado_pela_pessoa', 'INTEGER NOT NULL DEFAULT 0');

  // Herança do Asaas: se `pagamento_id` acabou de nascer num banco que ainda
  // tem a coluna antiga, copia os IDs para não perder o histórico. Quem criou
  // a coluna é quem faz o backfill, então isso roda uma vez só mesmo com
  // vários processos subindo juntos.
  if (pagamentoIdNasceuAgora && colunasAntigas.has('asaas_payment_id')) {
    db.exec(`UPDATE pedidos SET pagamento_id = asaas_payment_id`);
  }

  // A coluna antiga não é dropada de propósito: SQLite < 3.35 não suporta
  // DROP COLUMN, e uma coluna órfã custa menos que um deploy que quebra no
  // ALTER.
}
garantirColunas();

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
  produto: ProdutoId;
  /** JSON com eixos, ângulo, magnitude e os 12 escores (SPEC 0.8). */
  perfil_json: string | null;
  desempatado_pela_pessoa: number;
  status: StatusPedido;
  pagamento_id: string | null;
  pix_copia_e_cola: string | null;
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
  produto: ProdutoId;
}) {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO pedidos
      (id, nome, email, respostas_json, familiar, lua, signo_sol, signo_lua, produto, status, criado_em, atualizado_em)
     VALUES (@id, @nome, @email, @respostas_json, @familiar, @lua, @signo_sol, @signo_lua, @produto, 'aguardando_pagamento', @agora, @agora)`
  ).run({ ...p, agora });
}

export function buscarPedido(id: string): Pedido | undefined {
  return db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id) as
    | Pedido
    | undefined;
}

export function buscarPedidoPorPagamentoId(pagamentoId: string): Pedido | undefined {
  return db
    .prepare('SELECT * FROM pedidos WHERE pagamento_id = ?')
    .get(pagamentoId) as Pedido | undefined;
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
