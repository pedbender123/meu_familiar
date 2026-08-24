import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import { precoComDesconto } from './cupons';
import { produtoVigente, precoVigenteCentavos } from './modelo-de-venda';

/**
 * O que o cliente paga DEPOIS do cupom de lançamento.
 *
 * ── O erro que isto trava ─────────────────────────────────────────────────
 *
 * O `LANCAMENTO20` é aplicado automaticamente a todo pedido. Durante 12 horas
 * o preço cheio da Revelação foi R$ 9,80 — o valor que o anúncio promete —, e
 * o cupom cobrou **R$ 7,84**. O desconto comeu a margem em vez de servir de
 * argumento de venda.
 *
 * O preço cheio precisa ABSORVER o cupom. O que estes testes garantem não é
 * qual é o preço cheio, e sim **quanto entra no caixa** — que é o número que
 * o dono confere no extrato.
 */

const DESCONTO_DE_LANCAMENTO = 20;

beforeEach(() => {
  db.exec('DELETE FROM interruptores');
});

describe('o valor que o cliente paga', () => {
  test('Revelação sai a R$ 9,80 com o cupom aplicado', () => {
    const preco = precoComDesconto(produtoVigente('revelacao'), DESCONTO_DE_LANCAMENTO);
    assert.equal(preco.finalCentavos, 980, 'é o preço anunciado; não pode sair menos');
  });

  test('Completa sai a R$ 18,90 com o cupom aplicado', () => {
    const preco = precoComDesconto(produtoVigente('completa'), DESCONTO_DE_LANCAMENTO);
    assert.equal(preco.finalCentavos, 1890);
  });

  /** Sem cupom, o cheio é o cheio — e é ele que aparece riscado na tela. */
  test('sem cupom, cobra o cheio', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 1225);
    assert.equal(precoVigenteCentavos('completa'), 2362);
  });

  /**
   * `precoComDesconto` arredonda para CIMA. 2363 × 0,8 = 1890,4 vira 1891 —
   * um centavo a mais do que o anunciado. É a diferença entre um cheio
   * escolhido no olho e um calculado.
   */
  test('o arredondamento é para cima, e os cheios foram escolhidos por isso', () => {
    assert.equal(Math.ceil(1225 * 0.8), 980);
    assert.equal(Math.ceil(2362 * 0.8), 1890);
    assert.equal(Math.ceil(2363 * 0.8), 1891, 'o valor ingênuo erraria por um centavo');
  });

  /** Tirar o cupom é o caminho de subir preço sem assustar. */
  test('desligar o cupom sobe para o cheio, sem mexer em código', () => {
    const semCupom = precoComDesconto(produtoVigente('revelacao'), 0);
    assert.equal(semCupom.finalCentavos, 1225);
  });
});
