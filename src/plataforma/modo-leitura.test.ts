import test from 'node:test';
import assert from 'node:assert/strict';
import { ehModoLeitura } from './modo-leitura';

test('a leitura de um livro é modo leitura', () => {
  assert.equal(ehModoLeitura('/conta/biblioteca/magia-elemental'), true);
  assert.equal(ehModoLeitura('/conta/biblioteca/magia-elemental/'), true);
});

test('a estante não é', () => {
  assert.equal(ehModoLeitura('/conta/biblioteca'), false);
  assert.equal(ehModoLeitura('/conta/biblioteca/'), false);
});

test('o resto da plataforma não é', () => {
  assert.equal(ehModoLeitura('/conta'), false);
  assert.equal(ehModoLeitura('/conta/oraculo'), false);
  assert.equal(ehModoLeitura('/conta/familiar/abc'), false);
  assert.equal(ehModoLeitura(null), false);
});
