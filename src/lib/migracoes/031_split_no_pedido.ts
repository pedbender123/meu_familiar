import type { Migracao } from './tipos';

/**
 * Quanto desta venda foi repassado a outras contas.
 *
 * ── O número errado que isto conserta ─────────────────────────────────────
 *
 * A Wiven manda no webhook o `commissionAmount`: o que sobra para a conta que
 * cobrou, já descontados a taxa DELES e os splits. Como só tínhamos o bruto e
 * esse líquido, a taxa era deduzida por subtração — e a subtração engolia o
 * split junto.
 *
 * Medido na venda de 27/08: R$ 18,90 de bruto, R$ 6,33 de líquido, e a taxa
 * apareceu como **R$ 12,57**. A taxa real era R$ 3,13; os outros R$ 9,44
 * foram repasse para o João e para o Pedro.
 *
 * O estrago era em dois lugares ao mesmo tempo: o painel financeiro mostrava
 * um custo de gateway de 66% da venda, e a Utmify recebia esse mesmo número
 * como `gatewayFee` — inflando o custo e afundando o lucro de toda a
 * campanha, que é justamente o número em que se decide escalar ou pausar.
 *
 * ── Por que uma coluna, e não recalcular ──────────────────────────────────
 *
 * `splitsDe()` é determinístico e daria o mesmo valor. Mas ele lê a
 * configuração ATUAL, e o webhook chega minutos — às vezes horas — depois da
 * cobrança. Mudar o percentual entre uma coisa e outra reescreveria a
 * contabilidade de vendas antigas sem ninguém pedir.
 *
 * O que foi repassado é fato consumado. Fato consumado se grava.
 *
 * `NULL` em todo pedido anterior, e em toda venda sem split.
 */
const migracao: Migracao = {
  id: '031_split_no_pedido',
  descricao: 'Quanto da venda foi repassado a outras contas',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('split_centavos')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN split_centavos INTEGER`);
    }
  },
};

export default migracao;
