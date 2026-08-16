import test from 'node:test';
import assert from 'node:assert/strict';
import { montarCorpo } from './pagamento';
import { PRODUTOS } from './produtos';

/**
 * O corpo que sai para o Mercado Pago.
 *
 * ── Por que este arquivo existe ───────────────────────────────────────────
 *
 * Havia testes cobrindo `precoComDesconto`, e eles passavam — o cálculo sempre
 * esteve certo. O que estava errado era o CAMINHO: a rota de pagamento não
 * passava o percentual adiante, e um Pix de pedido com 20% de desconto saiu
 * cobrando o preço cheio. Testar a fórmula isolada não pega isso; testar o
 * valor que efetivamente vai no corpo da requisição, pega.
 */

const FORM = { payment_method_id: 'pix' };

test('sem cupom, cobra o preço de tabela', () => {
  const corpo = montarCorpo(FORM, PRODUTOS.completa, 'p1', 'a@b.com', 0);
  assert.equal(corpo.transaction_amount, 18.9);
});

test('com 20%, o valor que vai para o gateway é o com desconto', () => {
  // O caso exato que quebrou em produção.
  const corpo = montarCorpo(FORM, PRODUTOS.completa, 'p1', 'a@b.com', 20);
  assert.equal(corpo.transaction_amount, 15.12);
});

test('o desconto aplicado vai no metadata, para conferir depois no painel do MP', () => {
  const comCupom = montarCorpo(FORM, PRODUTOS.revelacao, 'p1', 'a@b.com', 20);
  assert.equal((comCupom.metadata as Record<string, unknown>).desconto, 20);

  const semCupom = montarCorpo(FORM, PRODUTOS.revelacao, 'p1', 'a@b.com', 0);
  assert.ok(!('desconto' in (semCupom.metadata as Record<string, unknown>)));
});

test('o valor nunca vem do formData do cliente', () => {
  // O Brick manda um transaction_amount no formData. Se ele fosse respeitado,
  // qualquer pessoa compraria por um centavo pelo DevTools.
  const hostil = { ...FORM, transaction_amount: 0.01 };
  const corpo = montarCorpo(hostil, PRODUTOS.completa, 'p1', 'a@b.com', 0);
  assert.equal(corpo.transaction_amount, 18.9);
});

test('todo produto com todo desconto gera um valor que o gateway aceita', () => {
  for (const produto of Object.values(PRODUTOS)) {
    for (let pct = 0; pct <= 100; pct++) {
      const { transaction_amount } = montarCorpo(FORM, produto, 'p', 'a@b.com', pct);
      assert.ok(
        transaction_amount === 0 || transaction_amount >= 1,
        `${produto.id} a ${pct}% gerou R$ ${transaction_amount}, que o MP recusa`
      );
      // Duas casas decimais: R$ 15,123 seria recusado. A comparação é por
      // tolerância porque 9.8 * 100 dá 980.0000000000001 em ponto flutuante —
      // o valor é redondo, a multiplicação é que não é exata.
      assert.ok(
        Math.abs(transaction_amount * 100 - Math.round(transaction_amount * 100)) < 1e-6,
        `${produto.id} a ${pct}% gerou R$ ${transaction_amount}, com centavo fracionário`
      );
    }
  }
});
