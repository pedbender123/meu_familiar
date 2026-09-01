import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import { precoComDesconto } from './cupons';
import {
  produtoVigente,
  precoVigenteCentavos,
  riscadoDe,
  PRECO_RISCADO_CENTAVOS,
} from './modelo-de-venda';

/**
 * O que entra no caixa — e a separação que faz isso ser simples de conferir.
 *
 * ── O erro que isto trava ─────────────────────────────────────────────────
 *
 * Houve um tempo em que o `LANCAMENTO20` era aplicado automaticamente a todo
 * pedido, e o número no código era um "cheio" do qual ele descia. Durante 12
 * horas o cheio da Revelação foi R$ 9,80 — o valor que o anúncio promete — e
 * o cupom cobrou **R$ 7,84**. O desconto comeu a margem em vez de servir de
 * argumento.
 *
 * Hoje o número no código É o preço. O riscado é decoração, mora à parte, e
 * não participa de conta nenhuma. Mudar preço é trocar um número.
 */

const DESCONTO_DE_LANCAMENTO = 20;

beforeEach(() => {
  db.exec('DELETE FROM interruptores');
});

describe('o valor que o cliente paga', () => {
  /**
   * ── O que mudou, e por que ────────────────────────────────────────────────
   *
   * Estes preços já foram "cheios" dos quais um cupom de 20% descia até o
   * valor real: o código dizia 1225 para o cliente pagar 9,80. Mudar preço
   * virava conta reversa com arredondamento para cima, e errá-la cobrava um
   * centavo a mais ou comia a margem — aconteceu, por doze horas, com uma
   * venda anunciada a 9,80 saindo por 7,84.
   *
   * Agora o número no código É o preço. O riscado da vitrine é decoração e
   * vive separado, em `PRECO_RISCADO_CENTAVOS`.
   */
  test('Simples custa R$ 18,90, sem conta por cima', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 1890);
    assert.equal(precoComDesconto(produtoVigente('revelacao'), 0).finalCentavos, 1890);
  });

  test('Completa custa R$ 24,90', () => {
    assert.equal(precoVigenteCentavos('completa'), 2490);
    assert.equal(precoComDesconto(produtoVigente('completa'), 0).finalCentavos, 2490);
  });

  /**
   * O riscado não pode encostar no que se cobra. Se um dia ele virar base de
   * cálculo, o cliente passa a pagar o número de vitrine.
   */
  test('o riscado é decoração e é maior que o preço', () => {
    assert.equal(riscadoDe('revelacao'), 2990);
    assert.equal(riscadoDe('completa'), 3990);
    assert.ok(riscadoDe('revelacao')! > precoVigenteCentavos('revelacao'));
    assert.ok(riscadoDe('completa')! > precoVigenteCentavos('completa'));
  });

  /** Riscado menor ou igual ao preço é erro de digitação, não promoção. */
  test('riscado que não é maior que o preço não aparece', () => {
    assert.equal(PRECO_RISCADO_CENTAVOS.revelacao! > 1890, true);
  });

  /** Cupom de verdade continua funcionando — para remarketing e resgate. */
  test('cupom manual ainda desconta', () => {
    const com45 = precoComDesconto(produtoVigente('completa'), 45);
    assert.equal(com45.finalCentavos, Math.ceil(2490 * 0.55));
  });
});

