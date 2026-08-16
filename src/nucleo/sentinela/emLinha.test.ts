import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../lib/db';
import { checarEmLinha } from './emLinha';
import { anomaliasAbertas } from './registrar';

beforeEach(() => {
  db.exec('DELETE FROM anomalias');
});

test('quando a checagem não acha nada, não registra anomalia nenhuma', () => {
  checarEmLinha('teste', () => null);
  assert.equal(anomaliasAbertas().length, 0);
});

test('quando a checagem acha uma anomalia, registra', () => {
  checarEmLinha('teste', () => ({
    invariante: 'x',
    severidade: 'alto',
    entidadeTipo: 'pedido',
    entidadeId: 'p1',
    esperado: 'a',
    encontrado: 'b',
  }));
  const [a] = anomaliasAbertas();
  assert.equal(a.invariante, 'x');
});

test('falha aberto: se a PRÓPRIA checagem lançar, não propaga — vira uma anomalia sobre a Sentinela', () => {
  assert.doesNotThrow(() => {
    checarEmLinha('checagem-com-bug', () => {
      throw new Error('null is not an object, oops');
    });
  });

  const abertas = anomaliasAbertas();
  assert.equal(abertas.length, 1);
  assert.equal(abertas[0].invariante, 'sentinela_checagem_falhou');
  assert.equal(abertas[0].entidadeId, 'checagem-com-bug');
  assert.match(abertas[0].encontrado, /null is not an object/);
});
