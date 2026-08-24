import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gatewayDaCampanha, gatewayDe, campanhaDoPedido } from './gateway';

const guardado = { ...process.env };
beforeEach(() => {
  delete process.env.GATEWAY;
  delete process.env.GATEWAY_PIX;
  delete process.env.GATEWAY_CARTAO;
  delete process.env.GATEWAY_POR_CAMPANHA;
  process.env.WIVEN_PUBLIC_KEY = 'pub';
  process.env.WIVEN_SECRET_KEY = 'sec';
  process.env.WIVEN_WEBHOOK_TOKEN = 'tok';
});
afterEach(() => {
  process.env = { ...guardado };
});

describe('a campanha escolhe a conta', () => {
  /**
   * O caso real: duas campanhas no ar ao mesmo tempo — a do dono cai no
   * Mercado Pago, a da agência cai na Wiven. Sem isto, a única forma de
   * separar seria dois sites.
   */
  test('cada campanha no seu gateway', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'agencia:wiven,dono:mercadopago';
    assert.equal(gatewayDaCampanha('agencia-familiar-agosto'), 'wiven');
    assert.equal(gatewayDaCampanha('dono-frio-01'), 'mercadopago');
  });

  /**
   * O nome que a Meta devolve raramente é o que se digitou no gerenciador.
   * Exigir igualdade exata faria a regra falhar em silêncio — e falhar em
   * silêncio aqui é dinheiro caindo na conta errada.
   */
  test('casa por trecho e ignora maiúscula', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'AGENCIA:wiven';
    assert.equal(gatewayDaCampanha('cmp_agencia_2026'), 'wiven');
    assert.equal(gatewayDaCampanha('CMP-Agencia'), 'wiven');
  });

  test('campanha desconhecida não escolhe nada', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'agencia:wiven';
    assert.equal(gatewayDaCampanha('black-friday'), undefined);
    assert.equal(gatewayDaCampanha(null), undefined);
    assert.equal(gatewayDaCampanha(''), undefined);
  });

  /** Configuração torta não pode virar gateway torto. */
  test('par malformado é ignorado, não explode', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'sem-dois-pontos,:wiven,agencia:,agencia:banco-do-ze';
    assert.equal(gatewayDaCampanha('agencia'), undefined);
  });

  test('a primeira chave que casa ganha', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'ag:mercadopago,agencia:wiven';
    assert.equal(gatewayDaCampanha('agencia-x'), 'mercadopago');
  });
});

describe('a ordem de quem manda', () => {
  /**
   * A campanha vem primeiro porque é a regra mais específica: ela fala de UMA
   * origem de tráfego, enquanto as outras falam do site inteiro. Quem escreve
   * "esta campanha vai para a Wiven" não espera que um `GATEWAY_PIX` global
   * mude isso pelas costas.
   */
  test('a campanha ganha do meio e do padrão', () => {
    process.env.GATEWAY = 'mercadopago';
    process.env.GATEWAY_PIX = 'mercadopago';
    process.env.GATEWAY_POR_CAMPANHA = 'agencia:wiven';
    assert.equal(gatewayDe('pix', 'agencia-01'), 'wiven');
  });

  test('sem campanha casando, o meio decide', () => {
    process.env.GATEWAY = 'mercadopago';
    process.env.GATEWAY_PIX = 'wiven';
    process.env.GATEWAY_POR_CAMPANHA = 'agencia:wiven';
    assert.equal(gatewayDe('pix', 'black-friday'), 'wiven');
    assert.equal(gatewayDe('cartao', 'black-friday'), 'mercadopago');
  });

  test('sem nada configurado, Mercado Pago', () => {
    assert.equal(gatewayDe('pix'), 'mercadopago');
    assert.equal(gatewayDe('cartao', 'qualquer'), 'mercadopago');
  });

  /**
   * A trava de segurança continua acima de tudo: campanha mandando para a
   * Wiven sem token de webhook cobraria e nunca entregaria.
   */
  test('campanha não fura a trava de configuração', () => {
    process.env.GATEWAY_POR_CAMPANHA = 'agencia:wiven';
    delete process.env.WIVEN_WEBHOOK_TOKEN;
    assert.equal(gatewayDe('pix', 'agencia-01'), 'mercadopago');
  });
});

describe('a campanha do pedido', () => {
  test('sai do utm_campaign', () => {
    assert.equal(
      campanhaDoPedido({ utm_json: JSON.stringify({ utm_campaign: 'agencia-01', utm_source: 'fb' }) }),
      'agencia-01'
    );
  });

  /** Anúncio que só marca a rede ainda separa "veio de anúncio" de "não veio". */
  test('cai no utm_source quando não há campanha', () => {
    assert.equal(campanhaDoPedido({ utm_json: JSON.stringify({ utm_source: 'facebook' }) }), 'facebook');
  });

  /** UTM torto não pode impedir a cobrança — cai no padrão. */
  test('json quebrado não derruba a venda', () => {
    assert.equal(campanhaDoPedido({ utm_json: '{isso não é json' }), null);
    assert.equal(campanhaDoPedido({ utm_json: null }), null);
    assert.equal(campanhaDoPedido({}), null);
  });
});
