import { buscarPedido, buscarPedidoPorPagamentoId } from '../lib/db';
import { pagamento } from '../lib/pagamento';
import { processarNotificacaoDePagamento } from '../lib/webhook-pagamento';
import { checarEmLinha } from './sentinela/emLinha';

export interface ResultadoReconciliacao {
  verificados: number;
  webhooksPerdidos: number;
  semPedidoLocal: number;
}

/**
 * Compara o que o Mercado Pago diz ter aprovado com o que o webhook gravou
 * aqui — a rede contra o pior tipo de falha: **pagamento aprovado, cliente
 * cobrado, e nada entregue** porque a notificação nunca chegou (rede caiu,
 * nosso servidor estava fora do ar no instante exato, o MP desistiu de
 * reentregar).
 *
 * ── Por que reprocessar em vez de só avisar ────────────────────────────────
 *
 * Quando acha um `aguardando_pagamento` que o MP já aprovou, chama
 * `processarNotificacaoDePagamento` — o MESMO caminho que o webhook chamaria
 * se tivesse chegado. Não existe uma segunda lógica de "marcar pago" para
 * manter sincronizada com a primeira; reconciliação É literalmente reproduzir
 * o webhook perdido.
 *
 * ── Por que uma janela, não "desde sempre" ─────────────────────────────────
 *
 * Pensada pra rodar em cron a cada poucas horas, olhando o período recente
 * (ex.: últimas 48h). Reconciliar o histórico inteiro é trabalho de script
 * manual pontual, não de rotina automática.
 */
export async function reconciliarPeriodo(
  desde: Date,
  ate: Date,
  // Injetável para teste — sem isto, testar "achou um webhook perdido"
  // exigiria credencial real de Mercado Pago. `pagamento` (o de produção) é
  // o padrão, então nada muda para quem chama sem o terceiro argumento.
  provedor: Pick<typeof pagamento, 'listarPagosNoPeriodo' | 'consultarPagamento'> = pagamento
): Promise<ResultadoReconciliacao> {
  const remotos = await provedor.listarPagosNoPeriodo(desde, ate);

  let webhooksPerdidos = 0;
  let semPedidoLocal = 0;

  for (const remoto of remotos) {
    if (remoto.status !== 'approved') continue;

    const pedido =
      buscarPedidoPorPagamentoId(remoto.idExterno) ??
      (remoto.referenciaExterna ? buscarPedido(remoto.referenciaExterna) : undefined);

    if (!pedido) {
      semPedidoLocal++;
      checarEmLinha('reconciliacao_pagamento_sem_pedido', () => ({
        invariante: 'pagamento_sem_pedido_local',
        severidade: 'critico',
        entidadeTipo: 'pagamento_mp',
        entidadeId: remoto.idExterno,
        esperado: 'todo pagamento aprovado no MP tem um pedido correspondente aqui',
        encontrado: `nenhum pedido achado (referência: ${remoto.referenciaExterna ?? 'nenhuma'})`,
      }));
      continue;
    }

    if (pedido.status !== 'aguardando_pagamento') continue; // já processado — nada a fazer

    // O MP aprovou e o pedido continua esperando: o webhook se perdeu.
    // Busca os dados completos (taxa, líquido, método — a busca em lote não
    // traz isso) e reprocessa pelo MESMO caminho do webhook.
    const completo = await provedor.consultarPagamento(remoto.idExterno);
    if (!completo) continue; // consulta falhou agora; a próxima rodada tenta de novo

    webhooksPerdidos++;
    const resultado = await processarNotificacaoDePagamento(completo);

    checarEmLinha('reconciliacao_webhook_perdido', () => ({
      invariante: 'webhook_perdido_reconciliado',
      severidade: 'alto',
      entidadeTipo: 'pedido',
      entidadeId: pedido.id,
      esperado: 'webhook confirma o pagamento na hora',
      encontrado: `só a reconciliação achou — pagamento ${remoto.idExterno} aprovado no MP, pedido ficou preso em aguardando_pagamento (desfecho do reprocessamento: ${resultado.desfecho})`,
      contexto: { pagamentoId: remoto.idExterno },
    }));
  }

  return { verificados: remotos.length, webhooksPerdidos, semPedidoLocal };
}
