import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { gatewayDaCampanha, campanhaDoPedido } from './gateway';

const g = process.env.GATEWAY_POR_CAMPANHA;
const usar = (v: string) => {
  process.env.GATEWAY_POR_CAMPANHA = v;
};
const restaurar = () => {
  if (g === undefined) delete process.env.GATEWAY_POR_CAMPANHA;
  else process.env.GATEWAY_POR_CAMPANHA = g;
};

describe('a campanha escolhe quem cobra', () => {
  /**
   * O que a Meta manda hoje, medido em produção: o ID NUMÉRICO da campanha,
   * não o nome. `utm_campaign: "120248890724340044"`.
   *
   * Configurar `começou:mercadopago` não pegaria nada — e não daria erro
   * nenhum, daria a venda caindo na conta errada, calada.
   */
  test('casa pelo id numérico que a Meta manda', () => {
    usar('120248890724340044:mercadopago');
    assert.equal(gatewayDaCampanha('120248890724340044'), 'mercadopago');
    restaurar();
  });

  test('campanha que não casa devolve indefinido, e o padrão decide', () => {
    usar('120248890724340044:mercadopago');
    assert.equal(gatewayDaCampanha('120299999999999999'), undefined);
    assert.equal(gatewayDaCampanha(null), undefined);
    assert.equal(gatewayDaCampanha(''), undefined);
    restaurar();
  });

  /** Para o dia em que o link mandar `{{campaign.name}}` em vez do id. */
  test('acento e maiúscula não separam a mesma campanha', () => {
    usar('comecou:mercadopago');
    for (const v of ['Começou', 'COMEÇOU', 'comecou', ' Começou ', 'campanha-Começou-agosto']) {
      assert.equal(gatewayDaCampanha(v), 'mercadopago', v);
    }
    restaurar();
  });

  test('a primeira chave que casa ganha', () => {
    usar('120248890724340044:mercadopago,1202:wiven');
    assert.equal(gatewayDaCampanha('120248890724340044'), 'mercadopago');
    restaurar();
  });

  test('gateway desconhecido na configuração é ignorado', () => {
    usar('120248890724340044:pagseguro');
    assert.equal(gatewayDaCampanha('120248890724340044'), undefined);
    restaurar();
  });
});

describe('de onde sai a campanha do pedido', () => {
  test('utm_campaign primeiro, utm_source como reserva', () => {
    assert.equal(
      campanhaDoPedido({ utm_json: '{"utm_source":"fb","utm_campaign":"120248890724340044"}' }),
      '120248890724340044'
    );
    assert.equal(campanhaDoPedido({ utm_json: '{"utm_source":"fb"}' }), 'fb');
  });

  /** UTM malformado não pode impedir a cobrança — cai no gateway padrão. */
  test('json quebrado ou ausente não derruba a venda', () => {
    assert.equal(campanhaDoPedido({ utm_json: '{quebrado' }), null);
    assert.equal(campanhaDoPedido({ utm_json: null }), null);
    assert.equal(campanhaDoPedido({}), null);
  });
});
