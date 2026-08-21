import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db, { criarPedido, buscarPedido, atualizarPedido } from '../lib/db';
import { podeMelhorar, buscarPedidoPorMelhoria, anotarPagamentoDaMelhoria } from './melhoria';

/**
 * A melhoria é uma SEGUNDA cobrança sobre um pedido já entregue. É o único
 * lugar do sistema onde isso acontece, e é onde as travas de idempotência do
 * funil normal não valem — por isso cada regra tem teste próprio.
 */

function pedido(sobrescreve: Record<string, unknown> = {}): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: `${id}@bruxario.local`,
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'aries',
    signo_lua: 'aries',
    produto: 'revelacao',
  });
  atualizarPedido(id, { status: 'entregue', ...sobrescreve });
  return id;
}

beforeEach(() => {
  db.exec("DELETE FROM pedidos WHERE email LIKE '%@bruxario.local'");
});

describe('quem pode ser melhorado', () => {
  test('uma Revelação já entregue', () => {
    assert.ok(podeMelhorar(buscarPedido(pedido())!));
  });

  test('não quem ainda não recebeu — não há o que melhorar', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ status: 'aguardando_pagamento' }))!), false);
  });

  test('não quem já tem a Completa', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ produto: 'completa' }))!), false);
  });

  /** A trava contra cobrar duas vezes pela mesma melhoria. */
  test('não quem já melhorou', () => {
    const id = pedido();
    atualizarPedido(id, { melhoria_paga_em: new Date().toISOString() });
    assert.equal(podeMelhorar(buscarPedido(id)!), false);
  });

  test('amostras nossas ficam de fora', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ exemplo: 1 }))!), false);
  });
});

describe('o pagamento da melhoria', () => {
  /**
   * O webhook casa a notificação por este campo. Se ele gravasse no
   * `pagamento_id` normal, a confirmação da melhoria seria lida como reenvio
   * da compra original e descartada — a pessoa pagaria e não receberia nada.
   */
  test('é gravado num campo separado do pagamento original', () => {
    const id = pedido({ pagamento_id: 'mp-compra-original' });
    anotarPagamentoDaMelhoria(id, 'mp-melhoria');

    const p = buscarPedido(id)!;
    assert.equal(p.pagamento_id, 'mp-compra-original', 'o original não é sobrescrito');
    assert.equal(p.melhoria_pagamento_id, 'mp-melhoria');
  });

  test('o webhook acha o pedido pelo id da melhoria', () => {
    const id = pedido();
    anotarPagamentoDaMelhoria(id, 'mp-xyz');
    assert.equal(buscarPedidoPorMelhoria('mp-xyz')?.id, id);
  });

  test('id que não é de melhoria nenhuma devolve undefined', () => {
    assert.equal(buscarPedidoPorMelhoria('mp-inexistente'), undefined);
  });
});
