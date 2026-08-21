import type { Migracao } from './tipos';

/**
 * A melhoria: trocar a Revelação pela Completa **depois** de já ter recebido.
 *
 * ── Por que uma coluna própria, e não reaproveitar `pagamento_id` ─────────
 *
 * O pedido já está `entregue` e já tem um `pagamento_id` — o da compra
 * original. Se a segunda cobrança gravasse no mesmo campo, o histórico
 * financeiro da primeira venda sumiria, e a reconciliação passaria a acusar
 * um pagamento órfão que na verdade existe.
 *
 * Mais grave: o webhook casa a notificação pelo `pagamento_id`. Com os dois
 * no mesmo campo, a confirmação da melhoria seria lida como reenvio da compra
 * original e descartada pela idempotência — a pessoa pagaria e não receberia
 * nada.
 *
 * `melhoria_paga_em` separado de `pago_em` pelo mesmo motivo: são dois
 * dinheiros, em dois momentos, e o relatório precisa contar os dois.
 */
const migracao: Migracao = {
  id: '025_melhoria_apos_entrega',
  descricao: 'Upgrade da Revelação para a Completa depois da entrega',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    const novas: [string, string][] = [
      ['melhoria_pagamento_id', 'TEXT'],
      ['melhoria_paga_em', 'TEXT'],
      ['melhoria_bruto_centavos', 'INTEGER'],
    ];
    for (const [nome, tipo] of novas) {
      if (!colunas.includes(nome)) {
        db.exec(`ALTER TABLE pedidos ADD COLUMN ${nome} ${tipo}`);
      }
    }
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_pedidos_melhoria
         ON pedidos (melhoria_pagamento_id)`
    );
  },
};

export default migracao;
