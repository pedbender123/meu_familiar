import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ceuDoDia } from './ceu-do-dia';

describe('ceuDoDia', () => {
  test('é determinístico: a mesma data devolve sempre a mesma coisa', () => {
    const quando = new Date('2026-03-15T12:00:00Z');
    assert.deepEqual(ceuDoDia(quando), ceuDoDia(quando));
  });

  test('a Lua muda de signo ao longo do mês (não devolve sempre o mesmo)', () => {
    const signos = new Set(
      [0, 4, 8, 12, 16, 20, 24].map(
        (dia) => ceuDoDia(new Date(2026, 2, 1 + dia)).luaEm
      )
    );
    assert.ok(signos.size > 3, `esperava vários signos num mês, veio ${signos.size}`);
  });

  test('percorre as quatro fases ao longo de um ciclo lunar', () => {
    const fases = new Set(
      Array.from({ length: 30 }, (_, dia) => ceuDoDia(new Date(2026, 2, 1 + dia)).faseDaLua)
    );
    assert.equal(fases.size, 4);
  });

  test('todo dia tem clima e nome de fase — nunca cai em texto vazio', () => {
    for (let dia = 0; dia < 60; dia++) {
      const ceu = ceuDoDia(new Date(2026, 0, 1 + dia));
      assert.ok(ceu.clima.length > 10);
      assert.ok(ceu.faseNome.length > 3);
    }
  });

  test('luaEmCasa só quando o signo da Lua de hoje bate com o natal', () => {
    const quando = new Date('2026-03-15T12:00:00Z');
    const hoje = ceuDoDia(quando);

    assert.equal(ceuDoDia(quando, hoje.luaEm).luaEmCasa, true);
    const outro = hoje.luaEm === 'Áries' ? 'Touro' : 'Áries';
    assert.equal(ceuDoDia(quando, outro).luaEmCasa, false);
  });

  test('sem lua natal, nunca marca luaEmCasa', () => {
    assert.equal(ceuDoDia(new Date('2026-03-15T12:00:00Z'), null).luaEmCasa, false);
    assert.equal(ceuDoDia(new Date('2026-03-15T12:00:00Z')).luaEmCasa, false);
  });
});
