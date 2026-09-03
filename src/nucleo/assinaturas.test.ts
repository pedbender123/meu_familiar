import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
import {
  criarAssinatura,
  buscarAssinaturaDoPedido,
  assinaturasAtivasDaConta,
  assinaturaPagaAtiva,
  todasAsAssinaturasDaConta,
} from './assinaturas';

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
});

describe('criarAssinatura', () => {
  test('cria e a devolve preenchida', () => {
    const contaId = randomUUID();
    const a = criarAssinatura({ contaId, planoId: 'revelacao' });
    assert.ok(a);
    assert.equal(a!.conta_id, contaId);
    assert.equal(a!.plano_id, 'revelacao');
    assert.equal(a!.status, 'ativa');
    assert.equal(a!.fim, null);
  });

  test('idempotente por pedido_id: o webhook reenvia, a segunda chamada não cria uma segunda linha', () => {
    const contaId = randomUUID();
    const pedidoId = randomUUID();

    const primeira = criarAssinatura({ contaId, planoId: 'revelacao', pedidoId });
    const segunda = criarAssinatura({ contaId, planoId: 'completa', pedidoId }); // até planoId diferente

    assert.equal(primeira!.id, segunda!.id, 'a segunda chamada devia devolver a MESMA assinatura');
    assert.equal(segunda!.plano_id, 'revelacao', 'não reescreve — a primeira grava vale');

    const total = (
      db.prepare('SELECT COUNT(*) AS n FROM assinaturas WHERE pedido_id = ?').get(pedidoId) as {
        n: number;
      }
    ).n;
    assert.equal(total, 1);
  });

  test('sem pedido_id, cada chamada cria uma assinatura nova (não há o que deduplicar)', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao' });
    criarAssinatura({ contaId, planoId: 'completa' });
    assert.equal(todasAsAssinaturasDaConta(contaId).length, 2);
  });
});

describe('assinaturasAtivasDaConta', () => {
  test('assinatura sem fim (vitalícia) está sempre ativa', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao', fim: null });
    assert.equal(assinaturasAtivasDaConta(contaId).length, 1);
  });

  test('assinatura com fim no FUTURO está ativa', () => {
    const contaId = randomUUID();
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    criarAssinatura({ contaId, planoId: 'revelacao', fim: futuro });
    assert.equal(assinaturasAtivasDaConta(contaId).length, 1);
  });

  test('assinatura com fim no PASSADO não conta como ativa, mesmo com status="ativa"', () => {
    const contaId = randomUUID();
    const passado = new Date(Date.now() - 86_400_000).toISOString();
    criarAssinatura({ contaId, planoId: 'revelacao', fim: passado });
    assert.equal(assinaturasAtivasDaConta(contaId).length, 0);
  });

  test('assinatura cancelada não conta, mesmo sem fim', () => {
    const contaId = randomUUID();
    const a = criarAssinatura({ contaId, planoId: 'revelacao' })!;
    db.prepare(`UPDATE assinaturas SET status = 'cancelada' WHERE id = ?`).run(a.id);
    assert.equal(assinaturasAtivasDaConta(contaId).length, 0);
  });

  test('conta sem nenhuma assinatura: lista vazia, não erro', () => {
    assert.deepEqual(assinaturasAtivasDaConta(randomUUID()), []);
  });

  test('não vaza assinatura de OUTRA conta', () => {
    const minhaConta = randomUUID();
    const outraConta = randomUUID();
    criarAssinatura({ contaId: outraConta, planoId: 'revelacao' });
    assert.deepEqual(assinaturasAtivasDaConta(minhaConta), []);
  });
});

test('buscarAssinaturaDoPedido acha pelo pedido, undefined se não existir', () => {
  const contaId = randomUUID();
  const pedidoId = randomUUID();
  assert.equal(buscarAssinaturaDoPedido(pedidoId), undefined);

  criarAssinatura({ contaId, planoId: 'revelacao', pedidoId });
  assert.equal(buscarAssinaturaDoPedido(pedidoId)?.conta_id, contaId);
});

/**
 * ── A conta que "assinava" sem nunca ter pago ─────────────────────────────
 *
 * O plano `gratuito` nasce junto com a conta e não tem fim. Enquanto o código
 * perguntava "tem assinatura ativa?", a resposta era sim para todo mundo — e
 * a biblioteca, que abre a estante inteira para quem assina, estava dando os
 * três livros vendidos no checkout para qualquer pessoa que tivesse entrado
 * uma vez.
 */
describe('assinaturaPagaAtiva', () => {
  test('o plano gratuito não faz de ninguém assinante', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'gratuito' });

    assert.equal(
      assinaturasAtivasDaConta(contaId).length,
      1,
      'ele É uma assinatura ativa — é justamente esse o problema'
    );
    assert.equal(assinaturaPagaAtiva(contaId), false);
  });

  test('um plano que custa dinheiro faz', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'revelacao_mensal' });
    assert.equal(assinaturaPagaAtiva(contaId), true);
  });

  test('vencida não vale, mesmo com o status parado em ativa', () => {
    const contaId = randomUUID();
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    criarAssinatura({ contaId, planoId: 'revelacao_mensal', fim: ontem });
    assert.equal(assinaturaPagaAtiva(contaId), false);
  });

  /**
   * A avulsa custa dinheiro e vira linha de assinatura — mas é compra única de
   * acesso, não plano. O acervo da biblioteca não foi vendido nela.
   */
  test('a avulsa paga não é assinatura', () => {
    const contaId = randomUUID();
    criarAssinatura({ contaId, planoId: 'avulsa_completa' });
    assert.equal(assinaturaPagaAtiva(contaId), false);
  });

  test('sem assinatura nenhuma, não', () => {
    assert.equal(assinaturaPagaAtiva(randomUUID()), false);
  });
});
