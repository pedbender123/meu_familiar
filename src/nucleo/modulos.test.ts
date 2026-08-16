import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS, buscarModulo, menuParaConta } from './modulos';
import { SEM_DIREITOS } from './direitos';

describe('MODULOS', () => {
  test('todo módulo tem id único', () => {
    const ids = MODULOS.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('buscarModulo', () => {
  test('acha pelo id', () => {
    assert.equal(buscarModulo('perfil')?.nome, 'Seu familiar');
  });

  test('undefined pra id que não existe', () => {
    assert.equal(buscarModulo('nao-existe'), undefined);
  });
});

describe('menuParaConta', () => {
  test('sem direito nenhum: todo item aparece, todos apagados (não some)', () => {
    const itens = menuParaConta(SEM_DIREITOS);
    assert.equal(itens.length, MODULOS.length);
    assert.ok(itens.every((i) => i.liberado === false));
  });

  test('com pdf e tiragemDiaria: os dois liberados', () => {
    const itens = menuParaConta({ ...SEM_DIREITOS, pdf: true, tiragemDiaria: true });
    assert.ok(itens.every((i) => i.liberado === true));
  });
});
