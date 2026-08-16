import db, { type Pedido } from '../../lib/db';
import { checarEmLinha } from './emLinha';
import { checarValorCobrado, checarEntregaTemPagamento } from './invariantes/financeiro';

/**
 * Roda todas as invariantes contra o banco inteiro (ou o recorte de
 * `pedidos` que se aplica a cada uma).
 *
 * Complementa a checagem em linha: aquela pega no instante em que o dado
 * nasce, esta pega pedidos que já existiam antes da Sentinela ligar, ou que
 * escaparam de alguma checagem em linha por qualquer motivo. As duas juntas
 * são a rede — nenhuma sozinha é suficiente.
 */
export function varrerPedidos(): { verificados: number } {
  const pedidos = db
    .prepare(`SELECT * FROM pedidos WHERE pago_em IS NOT NULL OR status = 'entregue'`)
    .all() as Pedido[];

  for (const pedido of pedidos) {
    checarEmLinha('varredura_valor_cobrado', () => checarValorCobrado(pedido));
    checarEmLinha('varredura_entrega_sem_pagamento', () => checarEntregaTemPagamento(pedido));
  }

  return { verificados: pedidos.length };
}
