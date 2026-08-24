import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gatewayPadrao, gatewayDe, meioDe } from './gateway';

/**
 * Quem cobra.
 *
 * A troca acontece com campanha no ar, e o valor destes testes é um só:
 * **esquecer de configurar não pode mandar dinheiro para o gateway errado.**
 */

const VARIAVEIS = ['GATEWAY', 'GATEWAY_PIX', 'GATEWAY_CARTAO', 'CAKTO_CLIENT_ID', 'CAKTO_CLIENT_SECRET'];

beforeEach(() => {
  for (const v of VARIAVEIS) delete process.env[v];
});

function comCakto() {
  process.env.CAKTO_CLIENT_ID = 'id';
  process.env.CAKTO_CLIENT_SECRET = 'segredo';
}

describe('o padrão', () => {
  test('sem nada configurado, é Mercado Pago — o que já está vendendo', () => {
    assert.equal(gatewayPadrao(), 'mercadopago');
  });

  test('valor errado no .env não vira Cakto por acidente', () => {
    process.env.GATEWAY = 'caktoo';
    assert.equal(gatewayPadrao(), 'mercadopago');
  });

  test('GATEWAY=cakto com credencial troca tudo', () => {
    comCakto();
    process.env.GATEWAY = 'cakto';
    assert.equal(gatewayDe('pix'), 'cakto');
    assert.equal(gatewayDe('cartao'), 'cakto');
  });
});

describe('rota por meio', () => {
  /**
   * O plano B: o Pix da Cakto é uma chamada REST e pronto; o cartão depende
   * do SDK deles, do antifraude e do 3DS no navegador. Se o cartão travar na
   * virada, ele volta sozinho pro MP sem desistir do resto.
   */
  test('Pix na Cakto e cartão no Mercado Pago, ao mesmo tempo', () => {
    comCakto();
    process.env.GATEWAY = 'mercadopago';
    process.env.GATEWAY_PIX = 'cakto';

    assert.equal(gatewayDe('pix'), 'cakto');
    assert.equal(gatewayDe('cartao'), 'mercadopago');
  });

  test('o específico sobrepõe o padrão, nos dois sentidos', () => {
    comCakto();
    process.env.GATEWAY = 'cakto';
    process.env.GATEWAY_CARTAO = 'mercadopago';

    assert.equal(gatewayDe('pix'), 'cakto');
    assert.equal(gatewayDe('cartao'), 'mercadopago');
  });
});

describe('a rede de segurança', () => {
  /**
   * Pedir Cakto sem credencial cairia em erro só na hora de cobrar — e o
   * sintoma seria venda perdida, não aviso no log.
   */
  test('Cakto sem credencial cai para o Mercado Pago em vez de quebrar a venda', () => {
    process.env.GATEWAY = 'cakto';
    assert.equal(gatewayDe('pix'), 'mercadopago');
  });

  test('credencial pela metade também não conta', () => {
    process.env.GATEWAY = 'cakto';
    process.env.CAKTO_CLIENT_ID = 'id';
    assert.equal(gatewayDe('pix'), 'mercadopago');
  });
});

describe('o meio, vindo dos dois fronts', () => {
  test('o Brick manda a bandeira; a Cakto manda credit_card. Os dois são cartão', () => {
    assert.equal(meioDe('master'), 'cartao');
    assert.equal(meioDe('visa'), 'cartao');
    assert.equal(meioDe('credit_card'), 'cartao');
    assert.equal(meioDe('threeDs'), 'cartao');
  });

  test('Pix é Pix nos dois', () => {
    assert.equal(meioDe('pix'), 'pix');
    assert.equal(meioDe('pix_auto'), 'pix');
  });

  /** Meio desconhecido cai em cartão: é o caminho que exige mais, nunca o que exige menos. */
  test('desconhecido vira cartão, não Pix', () => {
    assert.equal(meioDe(undefined), 'cartao');
    assert.equal(meioDe('coisa_nova'), 'cartao');
  });
});
