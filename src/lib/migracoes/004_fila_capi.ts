import type { Migracao } from './tipos';

/**
 * Fila de eventos do Conversions API — disciplina 6 de
 * docs/reestruturacao.md: "o pixel nunca depende do navegador".
 *
 * Hoje o CAPI só é usado por `scripts/backfill-pixel.ts`, manual e sob
 * opt-in (`--enviar`) — bom para consertar histórico, mas nada manda
 * Purchase pro Meta NA HORA que o pagamento confirma. Esta fila é a peça que
 * falta: todo pagamento confirmado entra aqui, e um processo à parte (não o
 * webhook, que precisa responder rápido) drena com retentativa.
 */
const migracao: Migracao = {
  id: '004_fila_capi',
  descricao: 'Fila de eventos do Conversions API, com retentativa',
  up: (db) => {
    db.exec(`
      CREATE TABLE fila_capi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id TEXT NOT NULL,
        evento_nome TEXT NOT NULL,
        event_id TEXT NOT NULL UNIQUE,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        tentativas INTEGER NOT NULL DEFAULT 0,
        ultimo_erro TEXT,
        criado_em TEXT NOT NULL,
        proxima_tentativa_em TEXT NOT NULL,
        enviado_em TEXT
      )
    `);
    db.exec(`CREATE INDEX idx_fila_capi_pendentes ON fila_capi (status, proxima_tentativa_em)`);
    db.exec(`CREATE INDEX idx_fila_capi_pedido ON fila_capi (pedido_id)`);
  },
};

export default migracao;
