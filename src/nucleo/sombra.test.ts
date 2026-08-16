import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
import { criarAssinatura } from './assinaturas';
import { compararAcessoEmSombra } from './sombra';
import { anomaliasAbertas } from './sentinela/registrar';

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM anomalias');
});

describe('compararAcessoEmSombra', () => {
  test('sem assinatura pro pedido ainda: silêncio, nenhuma anomalia (não é "bateu", é "não dá pra comparar")', () => {
    compararAcessoEmSombra(randomUUID(), randomUUID(), { graficos: true });
    assert.equal(anomaliasAbertas().length, 0);
  });

  test('quando bate, nenhuma anomalia', () => {
    const contaId = randomUUID();
    const pedidoId = randomUUID();
    criarAssinatura({ contaId, planoId: 'completa', pedidoId });

    compararAcessoEmSombra(contaId, pedidoId, { graficos: true, perfilPublico: true });
    assert.equal(anomaliasAbertas().length, 0);
  });

  test('quando diverge, registra uma anomalia média com o que cada lado disse', () => {
    const contaId = randomUUID();
    const pedidoId = randomUUID();
    // Assinatura da Revelação (sem gráficos)...
    criarAssinatura({ contaId, planoId: 'revelacao', pedidoId });

    // ...mas produtos.ts (o lado antigo, passado aqui como argumento) diz
    // que ESTE pedido específico tem gráficos — divergência de verdade.
    compararAcessoEmSombra(contaId, pedidoId, { graficos: true });

    const abertas = anomaliasAbertas('medio');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].invariante, 'nucleo_acesso_diverge_do_produto');
    assert.equal(abertas[0].entidadeId, contaId);
    assert.match(abertas[0].esperado, /true/);
    assert.match(abertas[0].encontrado, /false/);
  });

  test('só compara as chaves passadas — direito que não foi mencionado não gera ruído', () => {
    const contaId = randomUUID();
    const pedidoId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao', pedidoId }); // sem perguntasOraculo, sem narração etc.

    compararAcessoEmSombra(contaId, pedidoId, { pdf: true }); // só pdf, que bate
    assert.equal(anomaliasAbertas().length, 0);
  });

  test('mesma divergência não é reportada duas vezes (dedup da Sentinela já cobre)', () => {
    const contaId = randomUUID();
    const pedidoId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao', pedidoId });

    compararAcessoEmSombra(contaId, pedidoId, { graficos: true });
    compararAcessoEmSombra(contaId, pedidoId, { graficos: true });

    assert.equal(anomaliasAbertas().length, 1);
  });
});
