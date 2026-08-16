import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
import { criarAssinatura } from './assinaturas';
import { direitosDaConta, podeAcessar, cotaDe } from './acesso';
import { SEM_DIREITOS } from './direitos';

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
});

describe('direitosDaConta', () => {
  test('conta sem assinatura: SEM_DIREITOS', () => {
    assert.deepEqual(direitosDaConta(randomUUID()), SEM_DIREITOS);
  });

  test('conta com a Revelação: só o básico', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao' });
    const d = direitosDaConta(contaId);
    assert.equal(d.pdf, true);
    assert.equal(d.graficos, false);
    assert.equal(d.perguntasOraculo, 0);
  });

  test('conta com a Completa: tudo', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'completa' });
    const d = direitosDaConta(contaId);
    assert.equal(d.graficos, true);
    assert.equal(d.perguntasOraculo, 10);
  });

  test('conta com Revelação E Completa (comprou as duas): fica com o melhor dos dois — a união', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao' });
    criarAssinatura({ contaId, planoId: 'completa' });
    const d = direitosDaConta(contaId);
    assert.equal(d.graficos, true, 'a Completa libera, então a união libera');
    assert.equal(d.perguntasOraculo, 10);
  });

  test('assinatura expirada não entra na união', () => {
    const contaId = randomUUID();
    const passado = new Date(Date.now() - 86_400_000).toISOString();
    criarAssinatura({ contaId, planoId: 'completa', fim: passado });
    assert.deepEqual(direitosDaConta(contaId), SEM_DIREITOS);
  });

  test('assinatura apontando pra plano que não existe não quebra — só não contribui direito nenhum', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'plano-fantasma-que-nao-existe' });
    assert.deepEqual(direitosDaConta(contaId), SEM_DIREITOS);
  });
});

describe('podeAcessar', () => {
  test('libera quando o direito está presente', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'completa' });
    assert.equal(podeAcessar(contaId, 'graficos'), true);
    assert.equal(podeAcessar(contaId, 'perfilPublico'), true);
  });

  test('recusa quando o direito não está presente', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao' });
    assert.equal(podeAcessar(contaId, 'graficos'), false);
  });

  test('conta sem assinatura nenhuma: recusa tudo, não lança', () => {
    assert.equal(podeAcessar(randomUUID(), 'pdf'), false);
  });
});

test('cotaDe devolve o número, não um booleano', () => {
  const contaId = randomUUID();
  criarAssinatura({ contaId, planoId: 'completa' });
  assert.equal(cotaDe(contaId, 'perguntasOraculo'), 10);
});
