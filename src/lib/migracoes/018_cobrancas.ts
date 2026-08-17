import type { Migracao } from './tipos';

/**
 * `cobrancas` — a compra de um plano.
 *
 * ── Por que tabela nova e não `pedidos` ───────────────────────────────────
 *
 * `pedidos` é o funil: exige `respostas_json`, `familiar` e `lua` NOT NULL,
 * porque toda linha lá é alguém que fez o ritual. Assinar um plano não passa
 * por ritual nenhum — enfiar isso em `pedidos` obrigaria a inventar familiar
 * e respostas falsas, e envenenaria todo relatório de funil (conversão,
 * jornada, atribuição) com linhas que não são vendas de ritual.
 *
 * Separado, cada tabela continua contando a verdade sobre a própria coisa.
 *
 * ── O que a liga à assinatura ─────────────────────────────────────────────
 *
 * `assinatura_id` é preenchido quando o pagamento confirma. Ele existindo é o
 * que impede o webhook reenviado criar duas assinaturas da mesma cobrança —
 * a mesma ideia do `pedido_id` único em `assinaturas`.
 */
const migracao: Migracao = {
  id: '018_cobrancas',
  descricao: 'Cobranças de plano — a compra de assinatura, fora do funil de ritual',
  up: (db) => {
    db.exec(`
      CREATE TABLE cobrancas (
        id TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL,
        email TEXT NOT NULL,
        plano_id TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL,
        -- aguardando_pagamento | pago | cancelado
        status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
        pagamento_id TEXT,
        metodo TEXT,
        bruto_centavos INTEGER,
        taxa_centavos INTEGER,
        liquido_centavos INTEGER,
        assinatura_id TEXT,
        pago_em TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_cobrancas_conta ON cobrancas (conta_id, criado_em DESC)`);
    db.exec(`CREATE INDEX idx_cobrancas_pagamento ON cobrancas (pagamento_id)`);
    db.exec(`CREATE INDEX idx_cobrancas_status ON cobrancas (status)`);
  },
};

export default migracao;
