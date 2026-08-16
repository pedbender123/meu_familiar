import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido, buscarPedido, atualizarPedido } from '../lib/db';
import { reconciliarPeriodo } from './reconciliacao';
import { anomaliasAbertas } from './sentinela/registrar';
import type { PagamentoResumido, ResultadoPagamento } from './checkouts/mercadopago';

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

function provedorFalso(config: {
  remotos: PagamentoResumido[];
  detalhes?: Record<string, ResultadoPagamento>;
}) {
  return {
    async listarPagosNoPeriodo() {
      return config.remotos;
    },
    async consultarPagamento(id: string): Promise<ResultadoPagamento | null> {
      return config.detalhes?.[id] ?? null;
    },
  };
}

function detalheAprovado(sobrescreve: Partial<ResultadoPagamento> = {}): ResultadoPagamento {
  return {
    idExterno: 'mp-1',
    status: 'approved',
    statusDetalhe: 'accredited',
    referenciaExterna: null,
    brutoCentavos: 980,
    taxaCentavos: 39,
    liquidoCentavos: 941,
    metodo: 'pix',
    ...sobrescreve,
  };
}

beforeEach(() => {
  db.exec('DELETE FROM pedidos');
  db.exec('DELETE FROM eventos');
  db.exec('DELETE FROM anomalias');
});

describe('reconciliarPeriodo', () => {
  test('banco vazio de pagamentos remotos: não faz nada, não acusa nada', async () => {
    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({ remotos: [] })
    );
    assert.deepEqual(resultado, { verificados: 0, webhooksPerdidos: 0, semPedidoLocal: 0 });
    assert.equal(anomaliasAbertas().length, 0);
  });

  test('pagamento aprovado com pedido JÁ processado localmente: nada a fazer', async () => {
    const pedidoId = novoPedido();
    atualizarPedido(pedidoId, { status: 'pago', pagamento_id: 'mp-1', pago_em: new Date().toISOString() });

    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-1', status: 'approved', referenciaExterna: pedidoId }],
      })
    );

    assert.equal(resultado.webhooksPerdidos, 0);
    assert.equal(anomaliasAbertas().length, 0);
  });

  test('status não-aprovado (pending, rejected) no MP é ignorado', async () => {
    const pedidoId = novoPedido();
    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-1', status: 'pending', referenciaExterna: pedidoId }],
      })
    );
    assert.equal(resultado.webhooksPerdidos, 0);
    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');
  });

  test('O CASO PRINCIPAL: webhook perdido — MP aprovou, pedido preso em aguardando_pagamento, reconciliação conserta', async () => {
    const pedidoId = novoPedido();
    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');

    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-1', status: 'approved', referenciaExterna: pedidoId }],
        detalhes: { 'mp-1': detalheAprovado({ idExterno: 'mp-1', referenciaExterna: pedidoId }) },
      })
    );

    assert.equal(resultado.webhooksPerdidos, 1);

    // O pedido foi processado pelo MESMO caminho do webhook: pago, com o
    // valor gravado, e a entrega dele foi disparada (evento registrado).
    const pedido = buscarPedido(pedidoId)!;
    assert.equal(pedido.status, 'pago');
    assert.equal(pedido.bruto_centavos, 980);

    const abertas = anomaliasAbertas('alto');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].invariante, 'webhook_perdido_reconciliado');
    assert.equal(abertas[0].entidadeId, pedidoId);
  });

  test('pagamento aprovado sem NENHUM pedido correspondente é uma anomalia crítica', async () => {
    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-orfao', status: 'approved', referenciaExterna: null }],
      })
    );

    assert.equal(resultado.semPedidoLocal, 1);
    const abertas = anomaliasAbertas('critico');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].invariante, 'pagamento_sem_pedido_local');
    assert.equal(abertas[0].entidadeId, 'mp-orfao');
  });

  test('consulta de detalhe falha (null): não trava, não marca como resolvido — tenta de novo na próxima rodada', async () => {
    const pedidoId = novoPedido();
    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-1', status: 'approved', referenciaExterna: pedidoId }],
        detalhes: {}, // consultarPagamento devolve null
      })
    );

    assert.equal(resultado.webhooksPerdidos, 0, 'não conta como resolvido se não deu pra confirmar o detalhe');
    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');
  });

  test('casa pelo pagamento_id quando o pedido já tem um id diferente da referência do lote', async () => {
    const pedidoId = novoPedido();
    atualizarPedido(pedidoId, { pagamento_id: 'mp-1' }); // gravado numa tentativa anterior

    const resultado = await reconciliarPeriodo(
      new Date(0),
      new Date(),
      provedorFalso({
        remotos: [{ idExterno: 'mp-1', status: 'approved', referenciaExterna: null }],
        detalhes: { 'mp-1': detalheAprovado({ idExterno: 'mp-1', referenciaExterna: null }) },
      })
    );

    assert.equal(resultado.webhooksPerdidos, 1);
    assert.equal(buscarPedido(pedidoId)?.status, 'pago');
  });
});
