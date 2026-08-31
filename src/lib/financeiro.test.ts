import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * As consultas de receita precisam trazer `pagamento_id`.
 *
 * `receitaDoPedido` usa esse campo para separar "entregue sem cobrança" de
 * "cobrado mas sem valor gravado". Se a coluna não vier no SELECT, ela chega
 * `undefined`, a função conclui que não houve cobrança nenhuma, e o painel
 * inteiro passa a mostrar R$ 0,00.
 *
 * Foi exatamente o que aconteceu quando a função nasceu: o cálculo ficou
 * certo e a consulta ficou para trás. O tipo do TypeScript não pega — o
 * resultado de `db.prepare().all()` é afirmado à mão, então uma coluna que
 * falta no SQL continua existindo no tipo.
 */
/*
  A checagem olha CADA bloco `SELECT ... FROM pedidos` e exige que algum
  deles traga a coluna.

  Antes ela procurava `pagamento_id` numa janela de 700 caracteres depois do
  `SELECT`, o que é frágil pelo motivo errado: acrescentar um comentário
  dentro do SQL empurrava a coluna para fora da janela e o teste quebrava com
  a consulta perfeitamente correta. Uma guarda que dispara quando nada
  quebrou treina quem a vê a contornar a guarda.
*/
test('as consultas de receita trazem pagamento_id', () => {
  for (const arquivo of ['src/lib/financeiro.ts', 'src/lib/campanhas.ts']) {
    const fonte = readFileSync(arquivo, 'utf8');
    if (!fonte.includes('receitaDoPedido(')) continue;

    const blocos = fonte.match(/SELECT[\s\S]*?FROM\s+pedidos/gi) ?? [];
    assert.ok(blocos.length > 0, `${arquivo} não tem nenhuma consulta a pedidos`);
    assert.ok(
      blocos.some((b) => b.includes('pagamento_id')),
      `${arquivo} calcula receita sem selecionar pagamento_id`
    );
  }
});
