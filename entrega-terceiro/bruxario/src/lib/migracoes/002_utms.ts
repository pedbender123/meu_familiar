import type { Migracao } from './tipos';

/**
 * Os UTMs da chegada, gravados no pedido.
 *
 * ── Por que no pedido, e não só no navegador ──────────────────────────────
 *
 * A Utmify precisa saber de qual campanha veio a venda — e quem sabe que a
 * venda aconteceu é o webhook do gateway, que chega horas depois, sem
 * navegador nenhum por perto para consultar.
 *
 * Então os parâmetros são lidos da URL quando a pessoa chega, viajam com o
 * formulário até a criação do pedido, e ficam gravados ali. No dia em que o
 * pagamento confirmar, eles ainda estão lá.
 *
 * Guardados como JSON num campo só: são cinco a sete chaves que só existem
 * para ser repassadas inteiras, e nenhuma consulta filtra por elas.
 */
const migracao: Migracao = {
  id: '002_utms',
  descricao: 'Parâmetros de campanha da chegada, no pedido',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('utm_json')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN utm_json TEXT`);
    }
    if (!colunas.includes('ip_comprador')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN ip_comprador TEXT`);
    }
  },
};

export default migracao;
