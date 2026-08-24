import type { Migracao } from './tipos';

/**
 * Quem cobrou, e o telefone de quem comprou.
 *
 * ── `gateway` ─────────────────────────────────────────────────────────────
 *
 * Durante a virada existem dois gateways ativos ao mesmo tempo, possivelmente
 * um por meio de pagamento (Pix na Cakto, cartão no Mercado Pago). Sem esta
 * coluna, o painel não sabe a quem pedir um estorno, e a reconciliação não
 * sabe contra qual extrato comparar — e o `pagamento_id` sozinho não diz:
 * o do MP é numérico e o da Cakto é UUID, mas confiar no formato de um id de
 * terceiro é o tipo de suposição que quebra quando eles mudam.
 *
 * Fica `NULL` nos pedidos antigos, e `NULL` significa Mercado Pago: é o que
 * cobrava quando eles nasceram.
 *
 * ── `telefone` ────────────────────────────────────────────────────────────
 *
 * A Cakto exige `customer.phone` em E.164 para criar qualquer cobrança,
 * inclusive Pix. O ritual nunca pediu telefone — pedia nome, e-mail e CPF —,
 * então é um campo novo, coletado na tela de pagamento e guardado aqui.
 */
const migracao: Migracao = {
  id: '027_gateway_e_telefone',
  descricao: 'Qual gateway cobrou o pedido, e o telefone do comprador',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('gateway')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN gateway TEXT`);
    }
    if (!colunas.includes('telefone')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN telefone TEXT`);
    }
  },
};

export default migracao;
