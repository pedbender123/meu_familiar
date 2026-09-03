import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/*
  O remendo de navegador precisa ser importado ANTES de `./trilha`: o módulo
  lê `window` na primeira vez que alguém pergunta o estado. Ver
  `navegador-de-mentira.ts`.
*/
import { limparNavegadorDeMentira } from './navegador-de-mentira';
import {
  alternarRadio,
  estadoDaTrilha,
  fecharRadio,
  passarTrilha,
  pausarTrilha,
  pedirTrilha,
  tocarTrilha,
} from './trilha';

const LISTA = ['chuva-longe', 'fogo-crepitar', 'respiracao'];

beforeEach(() => {
  limparNavegadorDeMentira();
  tocarTrilha('chuva-longe');
  pausarTrilha();
  fecharRadio();
});

describe('a roda das faixas', () => {
  test('avança e volta para o começo', () => {
    tocarTrilha('respiracao');
    passarTrilha(LISTA, 1);
    assert.equal(estadoDaTrilha().id, 'chuva-longe');
  });

  test('voltar do primeiro cai no último', () => {
    tocarTrilha('chuva-longe');
    passarTrilha(LISTA, -1);
    assert.equal(estadoDaTrilha().id, 'respiracao');
  });

  test('passar de faixa sai tocando, mesmo pausado', () => {
    pausarTrilha();
    passarTrilha(LISTA, 1);
    assert.equal(estadoDaTrilha().tocando, true);
  });

  test('sem faixa nenhuma disponível, não faz nada', () => {
    const antes = estadoDaTrilha().id;
    passarTrilha([], 1);
    assert.equal(estadoDaTrilha().id, antes);
  });
});

describe('o capítulo pede, não manda', () => {
  test('com o som desligado, guarda a escolha e não toca', () => {
    pausarTrilha();
    pedirTrilha('fogo-crepitar');
    assert.equal(estadoDaTrilha().id, 'fogo-crepitar');
    assert.equal(estadoDaTrilha().tocando, false);
  });

  test('com o som ligado, troca a faixa', () => {
    tocarTrilha('chuva-longe');
    pedirTrilha('fogo-crepitar');
    assert.equal(estadoDaTrilha().id, 'fogo-crepitar');
    assert.equal(estadoDaTrilha().tocando, true);
  });
});

describe('o rádio', () => {
  test('nasce escondido', () => {
    assert.equal(estadoDaTrilha().aberto, false);
  });

  test('abrir e fechar não mexe no som', () => {
    tocarTrilha('chuva-longe');
    alternarRadio();
    assert.equal(estadoDaTrilha().aberto, true);
    assert.equal(estadoDaTrilha().tocando, true);
    alternarRadio();
    assert.equal(estadoDaTrilha().aberto, false);
    assert.equal(estadoDaTrilha().tocando, true);
  });
});
