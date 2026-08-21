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
test('as consultas de receita trazem pagamento_id', () => {
  for (const arquivo of ['src/lib/financeiro.ts', 'src/lib/campanhas.ts']) {
    const fonte = readFileSync(arquivo, 'utf8');
    if (!fonte.includes('receitaDoPedido(')) continue;
    assert.ok(
      /SELECT[\s\S]{0,700}pagamento_id/.test(fonte),
      `${arquivo} calcula receita sem selecionar pagamento_id`
    );
  }
});
