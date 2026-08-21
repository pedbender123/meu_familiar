import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido, atualizarPedido } from '../lib/db';
import { estadoDosAlarmes, verificarEAvisar } from './alarmes';
import { registrarAnomalia } from './sentinela/registrar';
import { enfileirarEventoCapi } from '../lib/fila-capi';

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
  db.exec('DELETE FROM pedidos');
  db.exec('DELETE FROM anomalias');
  db.exec('DELETE FROM fila_capi');
  delete process.env.ADMIN_EMAIL;
});

describe('estadoDosAlarmes', () => {
  test('banco limpo: nada pra avisar', () => {
    const estado = estadoDosAlarmes();
    assert.deepEqual(estado, {
      criticas: 0,
      altas: 0,
      pedidosTravados: 0,
      capiFalhouDefinitivo: 0,
      precisaAvisar: false,
    });
  });

  test('uma anomalia crítica basta para precisar avisar', () => {
    registrarAnomalia({
      invariante: 'x',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: 'p1',
      esperado: 'a',
      encontrado: 'b',
    });
    const estado = estadoDosAlarmes();
    assert.equal(estado.criticas, 1);
    assert.equal(estado.precisaAvisar, true);
  });

  test('anomalia baixa ou média NÃO dispara alarme — só crítica e alta', () => {
    registrarAnomalia({
      invariante: 'x',
      severidade: 'baixo',
      entidadeTipo: 'pedido',
      entidadeId: 'p1',
      esperado: 'a',
      encontrado: 'b',
    });
    registrarAnomalia({
      invariante: 'y',
      severidade: 'medio',
      entidadeTipo: 'pedido',
      entidadeId: 'p2',
      esperado: 'a',
      encontrado: 'b',
    });
    assert.equal(estadoDosAlarmes().precisaAvisar, false);
  });

  test('pedido travado (pago há muito tempo, poucas tentativas) conta', () => {
    const id = novoPedido();
    atualizarPedido(id, { status: 'pago' });
    const estado = estadoDosAlarmes();
    assert.equal(estado.pedidosTravados, 1);
    assert.equal(estado.precisaAvisar, true);
  });

  test('evento do CAPI que desistiu de vez conta', () => {
    const id = novoPedido();
    enfileirarEventoCapi({ pedidoId: id, nome: 'Purchase', quando: new Date(), eventId: `${id}:purchase` });
    db.prepare(`UPDATE fila_capi SET status = 'falhou_definitivo' WHERE pedido_id = ?`).run(id);

    const estado = estadoDosAlarmes();
    assert.equal(estado.capiFalhouDefinitivo, 1);
    assert.equal(estado.precisaAvisar, true);
  });
});

describe('verificarEAvisar', () => {
  test('nada pra avisar: não manda e-mail', async () => {
    const { avisou } = await verificarEAvisar();
    assert.equal(avisou, false);
  });

  test('há algo, mas ADMIN_EMAIL não configurado: não trava, só avisa no log', async () => {
    registrarAnomalia({
      invariante: 'x',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: 'p1',
      esperado: 'a',
      encontrado: 'b',
    });
    const { avisou } = await verificarEAvisar();
    assert.equal(avisou, false); // não consegue avisar, mas não lança
  });

  test('com ADMIN_EMAIL e algo pra avisar, dispara o envio (modo console, sem RESEND_API_KEY)', async () => {
    process.env.ADMIN_EMAIL = 'dono@bruxario.com.br';
    registrarAnomalia({
      invariante: 'x',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: 'p1',
      esperado: 'a',
      encontrado: 'b',
    });

    const { avisou } = await verificarEAvisar();
    assert.equal(avisou, true);
  });
});
