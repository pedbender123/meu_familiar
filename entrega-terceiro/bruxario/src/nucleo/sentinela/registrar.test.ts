import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from '../../lib/db';
import {
  registrarAnomalia,
  anomaliasAbertas,
  anomaliasRecentes,
  resolverAnomalia,
  contagemPorInvariante,
} from './registrar';

beforeEach(() => {
  db.exec('DELETE FROM anomalias');
});

function anomaliaDeTeste(sobrescreve: Partial<Parameters<typeof registrarAnomalia>[0]> = {}) {
  return {
    invariante: 'teste_invariante',
    severidade: 'critico' as const,
    entidadeTipo: 'pedido',
    entidadeId: 'p1',
    esperado: 'x',
    encontrado: 'y',
    ...sobrescreve,
  };
}

test('registra e reaparece em abertas', () => {
  registrarAnomalia(anomaliaDeTeste());
  const abertas = anomaliasAbertas();
  assert.equal(abertas.length, 1);
  assert.equal(abertas[0].invariante, 'teste_invariante');
  assert.equal(abertas[0].resolvidoEm, null);
  assert.equal(abertas[0].falsoPositivo, false);
});

test('contexto vai e volta como objeto, não como string', () => {
  registrarAnomalia(anomaliaDeTeste({ contexto: { produto: 'completa', cupom: 'X10' } }));
  const [a] = anomaliasAbertas();
  assert.deepEqual(a.contexto, { produto: 'completa', cupom: 'X10' });
});

test('resolver tira da lista de abertas', () => {
  const id = registrarAnomalia(anomaliaDeTeste());
  resolverAnomalia(id, 'investigado, era duplicata de webhook');
  assert.equal(anomaliasAbertas().length, 0);

  const [recente] = anomaliasRecentes(1);
  assert.equal(recente.resolucao, 'investigado, era duplicata de webhook');
  assert.equal(recente.falsoPositivo, false);
});

test('resolver como falso positivo grava a marca', () => {
  const id = registrarAnomalia(anomaliaDeTeste());
  resolverAnomalia(id, 'era esperado neste caso', true);
  const [recente] = anomaliasRecentes(1);
  assert.equal(recente.falsoPositivo, true);
});

test('filtro por severidade só traz a severidade pedida', () => {
  // entidadeId diferente em cada uma: são DUAS anomalias reais, não a mesma
  // repetida (que a deduplicação abaixo trata como uma só, de propósito).
  registrarAnomalia(anomaliaDeTeste({ severidade: 'critico', entidadeId: 'p1' }));
  registrarAnomalia(anomaliaDeTeste({ severidade: 'baixo', entidadeId: 'p2' }));
  assert.equal(anomaliasAbertas('critico').length, 1);
  assert.equal(anomaliasAbertas('baixo').length, 1);
  assert.equal(anomaliasAbertas().length, 2);
});

test('não registra duas vezes o MESMO achado (mesma invariante, entidade, esperado e encontrado)', () => {
  const primeiro = registrarAnomalia(anomaliaDeTeste());
  const segundo = registrarAnomalia(anomaliaDeTeste());
  assert.ok(primeiro !== null);
  assert.equal(segundo, null, 'a segunda chamada idêntica devia ser deduplicada');
  assert.equal(anomaliasAbertas().length, 1);
});

test('achado repetido continua deduplicado mesmo depois de já ter sido RESOLVIDO', () => {
  // É o caso real que motivou a deduplicação: um pedido legado que viola a
  // invariante para sempre (dado antigo, não vai mudar). Resolver uma vez
  // não pode significar "reabre sozinho na próxima varredura".
  const id = registrarAnomalia(anomaliaDeTeste())!;
  resolverAnomalia(id, 'investigado — é dado legado, não vai mudar');

  const segunda = registrarAnomalia(anomaliaDeTeste());
  assert.equal(segunda, null);
  assert.equal(anomaliasAbertas().length, 0, 'continua resolvida, não reabre');
});

test('mesma entidade, achado DIFERENTE (esperado/encontrado mudou) NÃO é deduplicado', () => {
  registrarAnomalia(anomaliaDeTeste({ encontrado: 'y' }));
  const segundo = registrarAnomalia(anomaliaDeTeste({ encontrado: 'z' }));
  assert.ok(segundo !== null, 'um achado genuinamente diferente precisa aparecer');
  assert.equal(anomaliasAbertas().length, 2);
});

test('contagemPorInvariante agrupa e ignora as já resolvidas', () => {
  registrarAnomalia(anomaliaDeTeste({ invariante: 'a', entidadeId: 'p1' }));
  registrarAnomalia(anomaliaDeTeste({ invariante: 'a', entidadeId: 'p2' }));
  const idResolvida = registrarAnomalia(anomaliaDeTeste({ invariante: 'b', entidadeId: 'p3' }))!;
  resolverAnomalia(idResolvida, 'ok');

  const contagem = contagemPorInvariante();
  assert.deepEqual(contagem, [{ invariante: 'a', severidade: 'critico', n: 2 }]);
});
