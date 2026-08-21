import db, { buscarPedido, atualizarPedido, registrarEvento, type Pedido } from '../lib/db';
import { processarPedido } from '../lib/processar';

/**
 * A melhoria: trocar a Revelação pela Completa **depois** da entrega.
 *
 * ── Por que ela é uma venda diferente ─────────────────────────────────────
 *
 * O funil normal cobra antes de entregar. Aqui a pessoa já leu o que comprou,
 * já sabe se gostou, e a decisão é outra: *"quero mais disso"*. É a venda mais
 * fácil que existe, e é a única que só pode acontecer depois.
 *
 * Por isso ela não reaproveita nada do caminho de compra: o pedido está
 * `entregue`, e mexer no status dele para forçá-lo de volta a
 * `aguardando_pagamento` tiraria da pessoa o acesso ao que já é dela enquanto
 * o pagamento não confirmasse.
 */

/** O que a melhoria custa. Preço de oferta, não a diferença de tabela. */
export const PRECO_DA_MELHORIA_CENTAVOS = 490;

export function podeMelhorar(pedido: Pedido): boolean {
  return (
    pedido.status === 'entregue' &&
    pedido.produto === 'revelacao' &&
    !pedido.melhoria_paga_em &&
    pedido.exemplo !== 1
  );
}

export function buscarPedidoPorMelhoria(pagamentoId: string): Pedido | undefined {
  return db
    .prepare('SELECT * FROM pedidos WHERE melhoria_pagamento_id = ?')
    .get(pagamentoId) as Pedido | undefined;
}

export function anotarPagamentoDaMelhoria(pedidoId: string, pagamentoId: string): void {
  db.prepare('UPDATE pedidos SET melhoria_pagamento_id = ? WHERE id = ?').run(
    pagamentoId,
    pedidoId
  );
}

/**
 * Confirma a melhoria: troca o produto e gera de novo o que muda.
 *
 * ── Idempotente ───────────────────────────────────────────────────────────
 *
 * `melhoria_paga_em` é a trava. O gateway reenvia a notificação, e sem ela a
 * segunda passagem regeneraria a leitura inteira — outra chamada de IA paga,
 * e um PDF diferente do que a pessoa já tinha baixado.
 *
 * ── O que é regenerado, e por quê tudo ────────────────────────────────────
 *
 * `processarPedido` refaz a leitura (agora longa), as artes, o PDF e a
 * narração. Não dá para refazer só um pedaço: o texto longo muda o PDF, e o
 * PDF é o que a pessoa guarda. Refazer parcial deixaria um artefato costurado
 * de duas gerações diferentes.
 */
export async function confirmarMelhoria(
  pedidoId: string,
  dados: { brutoCentavos?: number | null } = {}
): Promise<boolean> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return false;

  if (pedido.melhoria_paga_em) return false;

  atualizarPedido(pedidoId, {
    produto: 'completa',
    melhoria_paga_em: new Date().toISOString(),
    melhoria_bruto_centavos: dados.brutoCentavos ?? PRECO_DA_MELHORIA_CENTAVOS,
    // Volta a `gerando` para a tela de espera saber que há algo acontecendo —
    // `processarPedido` a devolve para `entregue` no fim.
    status: 'gerando',
  });
  registrarEvento('melhoria_confirmada', pedidoId);

  await processarPedido(pedidoId);
  return true;
}
