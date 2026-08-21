import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { metodoParaUtmify } from './utmify';

describe('o método de pagamento traduzido', () => {
  test('os nomes do gateway viram os da Utmify', () => {
    assert.equal(metodoParaUtmify('pix'), 'pix');
    assert.equal(metodoParaUtmify('billet'), 'boleto');
    assert.equal(metodoParaUtmify('credit_card'), 'credit_card');
  });

  /**
   * Um método desconhecido não pode sumir com a venda do relatório: melhor
   * uma linha com o método errado que uma venda invisível na campanha.
   */
  test('método desconhecido não derruba o envio', () => {
    assert.equal(metodoParaUtmify('metodo_novo'), 'pix');
    assert.equal(metodoParaUtmify(null), 'pix');
    assert.equal(metodoParaUtmify(undefined), 'pix');
  });

  test('não é sensível a caixa', () => {
    assert.equal(metodoParaUtmify('BILLET'), 'boleto');
  });
});
