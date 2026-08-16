import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido, atualizarPedido } from '../../lib/db';
import { varrerPedidos } from './varredura';
import { anomaliasAbertas } from './registrar';

function novoPedido(): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: 'helena@exemplo.com',
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'Touro',
    signo_lua: 'Touro',
    produto: 'revelacao',
  });
  return id;
}

beforeEach(() => {
  db.exec('DELETE FROM anomalias');
  db.exec('DELETE FROM pedidos');
});

test('varredura não acusa nada num banco saudável', () => {
  const id = novoPedido();
  atualizarPedido(id, {
    status: 'pago',
    pago_em: new Date().toISOString(),
    bruto_centavos: 980,
  });

  const { verificados } = varrerPedidos();
  assert.equal(verificados, 1);
  assert.equal(anomaliasAbertas().length, 0);
});

test('varredura pega um pedido pago sem cobrança que existia ANTES da Sentinela ligar', () => {
  const id = novoPedido();
  // Simula um pedido corrompido de antes de existir Sentinela: pago, sem
  // valor registrado, sem cupom — exatamente o caso suspeito original.
  atualizarPedido(id, {
    status: 'pago',
    pago_em: new Date().toISOString(),
    bruto_centavos: null,
  });

  varrerPedidos();

  const abertas = anomaliasAbertas('critico');
  assert.equal(abertas.length, 1);
  assert.equal(abertas[0].entidadeId, id);
  assert.equal(abertas[0].invariante, 'valor_cobrado_bate_com_produto_e_cupom');
});

test('varredura pega pedido entregue sem nunca ter sido pago', () => {
  const id = novoPedido();
  atualizarPedido(id, { status: 'entregue' }); // pago_em nunca foi setado

  varrerPedidos();

  const invariantes = anomaliasAbertas('critico').map((a) => a.invariante);
  assert.ok(invariantes.includes('entrega_sem_pagamento'));
});

test('varredura não olha pedido que nunca foi pago nem entregue', () => {
  novoPedido(); // fica em aguardando_pagamento

  const { verificados } = varrerPedidos();
  assert.equal(verificados, 0);
});
