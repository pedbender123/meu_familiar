import test from 'node:test';
import assert from 'node:assert/strict';
import { portaConfere, selarPorta, VALIDADE_DA_PORTA_HORAS } from './porta-do-comprador';

const PEDIDO = '9bc9a90f-0000-4000-8000-000000000000';
const OUTRO = '11111111-0000-4000-8000-000000000000';
const AGORA = new Date('2026-09-03T10:00:00.000Z');

test('o selo do próprio pedido confere', () => {
  const { valor } = selarPorta(PEDIDO, AGORA);
  assert.equal(portaConfere(PEDIDO, valor, AGORA), true);
});

test('o selo de um pedido não abre outro', () => {
  const { valor } = selarPorta(PEDIDO, AGORA);
  assert.equal(portaConfere(OUTRO, valor, AGORA), false);
});

test('sem cookie não há porta', () => {
  assert.equal(portaConfere(PEDIDO, undefined, AGORA), false);
  assert.equal(portaConfere(PEDIDO, '', AGORA), false);
});

test('cookie inventado não abre', () => {
  const daqui = new Date(AGORA.getTime() + 3_600_000).getTime();
  assert.equal(portaConfere(PEDIDO, `${daqui}.qualquercoisa`, AGORA), false);
  assert.equal(portaConfere(PEDIDO, 'sem-ponto', AGORA), false);
  assert.equal(portaConfere(PEDIDO, '.assinatura', AGORA), false);
});

test('depois do prazo a porta fecha', () => {
  const { valor } = selarPorta(PEDIDO, AGORA);
  const depois = new Date(AGORA.getTime() + (VALIDADE_DA_PORTA_HORAS + 1) * 3_600_000);
  assert.equal(portaConfere(PEDIDO, valor, depois), false);
});

test('prolongar o prazo à mão invalida a assinatura', () => {
  const { valor } = selarPorta(PEDIDO, AGORA);
  const assinatura = valor.slice(valor.indexOf('.') + 1);
  const daqui = new Date(AGORA.getTime() + 999 * 3_600_000).getTime();
  assert.equal(portaConfere(PEDIDO, `${daqui}.${assinatura}`, AGORA), false);
});
