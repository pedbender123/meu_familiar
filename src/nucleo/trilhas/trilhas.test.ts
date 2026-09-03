import test from 'node:test';
import assert from 'node:assert/strict';
import { TRILHAS, podeOuvir, trilhaPorId } from './catalogo';
import { trilhasNoAr } from './servidor';

test('os ids não se repetem', () => {
  const ids = TRILHAS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('todo arquivo é um caminho servido pelo navegador', () => {
  for (const trilha of TRILHAS) {
    assert.match(trilha.arquivo, /^\/audio\/.+\.mp3$/, trilha.id);
  }
});

test('faixa desconhecida não vira faixa', () => {
  assert.equal(trilhaPorId('nao-existe'), null);
  assert.equal(trilhaPorId(null), null);
});

test('quem não assina ouve as gratuitas e vê o resto', () => {
  const gratuita = TRILHAS.find((t) => t.gratuita)!;
  const paga = TRILHAS.find((t) => !t.gratuita)!;
  assert.equal(podeOuvir(gratuita, false), true);
  assert.equal(podeOuvir(paga, false), false);
  assert.equal(podeOuvir(paga, true), true);
});

/**
 * O teste que impede a lista de mentir: se alguém escrever uma faixa nova sem
 * pôr o arquivo, ela não aparece — e é isso que este teste está afirmando,
 * não que existam N faixas.
 */
test('só entra no ar o que está em disco', () => {
  const noAr = trilhasNoAr();
  assert.ok(noAr.length >= 1, 'ao menos uma faixa precisa existir de verdade');
  assert.ok(noAr.length <= TRILHAS.length);
  for (const trilha of noAr) {
    assert.ok(TRILHAS.includes(trilha));
  }
});

test('as faixas abertas de hoje são as que já tocam no site', () => {
  const abertas = trilhasNoAr().filter((t) => t.gratuita).map((t) => t.id);
  assert.deepEqual(abertas.sort(), ['chuva-longe', 'fogo-crepitar']);
});
