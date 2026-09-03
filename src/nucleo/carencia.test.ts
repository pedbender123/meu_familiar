import test from 'node:test';
import assert from 'node:assert/strict';
import { DIAS_DE_CARENCIA, estadoDoDownload, podeBaixar } from './carencia';

const UM_DIA = 86_400_000;
const AGORA = new Date('2026-09-10T12:00:00.000Z');

function haDias(dias: number): string {
  return new Date(AGORA.getTime() - dias * UM_DIA).toISOString();
}

test('sem pagamento não abre nunca', () => {
  const estado = estadoDoDownload(null, AGORA);
  assert.equal(estado.liberado, false);
  assert.equal(estado.abreEm, null);
});

test('data ilegível é tratada como sem compra', () => {
  assert.equal(podeBaixar('ontem à noite', AGORA), false);
});

test('no dia da compra ainda não abre, e faltam sete', () => {
  const estado = estadoDoDownload(haDias(0), AGORA);
  assert.equal(estado.liberado, false);
  assert.equal(estado.diasQueFaltam, DIAS_DE_CARENCIA);
});

test('no sexto dia ainda está fechado', () => {
  assert.equal(podeBaixar(haDias(6), AGORA), false);
  assert.equal(estadoDoDownload(haDias(6), AGORA).diasQueFaltam, 1);
});

test('no sétimo dia abre', () => {
  const estado = estadoDoDownload(haDias(7), AGORA);
  assert.equal(estado.liberado, true);
  assert.equal(estado.diasQueFaltam, 0);
});

test('compra antiga continua aberta', () => {
  assert.equal(podeBaixar(haDias(400), AGORA), true);
});

test('o momento exato da virada abre, não fecha', () => {
  const pago = new Date(AGORA.getTime() - DIAS_DE_CARENCIA * UM_DIA).toISOString();
  assert.equal(podeBaixar(pago, AGORA), true);
});
