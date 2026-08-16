import {
  buscarPedido,
  buscarPedidoPorPagamentoId,
  atualizarPedido,
  registrarEvento,
} from './db';
import { statusLiberaAcesso, type ResultadoPagamento } from './pagamento';
import { calcularExpiracao, produtoDe } from './produtos';
import { aposPagamento } from './processar';

export type DesfechoNotificacao =
  | 'nao_libera_acesso'
  | 'sem_pedido'
  | 'ja_processado'
  | 'processado';

export interface ResultadoNotificacao {
  desfecho: DesfechoNotificacao;
  /**
   * Só presente quando `desfecho === 'processado'`. A entrega roda em
   * segundo plano DE PROPÓSITO — fogo e esquece, sem `await` — para o
   * webhook responder rápido ao Mercado Pago em vez de segurar a resposta
   * pelo tempo que a geração (leitura, PDF, e-mail) levar. Se o processo
   * cair no meio, `pedidosTravados()`/`npm run reprocessar` é a rede que
   * pega o que ficou pra trás.
   *
   * Exposta aqui só para quem PRECISA saber quando a entrega termina —
   * hoje, o teste do caminho crítico. `api/webhook/route.ts` ignora este
   * campo, para não mudar a latência da resposta.
   */
  entrega?: Promise<void>;
}

/**
 * O que acontece depois que a consulta ao Mercado Pago voltou — a parte do
 * webhook que independe de HTTP, assinatura ou parsing de request.
 *
 * Extraída de `api/webhook/route.ts` para ser testável sem subir um servidor
 * Next (docs/reestruturacao.md, Fase 0: "teste automatizado do caminho
 * crítico"). Mesma lógica que estava inline ali, palavra por palavra — só
 * mudou de lugar, para o teste exercitar exatamente o que roda em produção
 * em vez de uma cópia que pode divergir do real com o tempo.
 */
export async function processarNotificacaoDePagamento(
  resultado: ResultadoPagamento
): Promise<ResultadoNotificacao> {
  if (!statusLiberaAcesso(resultado.status)) {
    registrarEvento(`pagamento_${resultado.status}`);
    return { desfecho: 'nao_libera_acesso' };
  }

  // Casa por `pagamento_id` (gravado na criação) ou pela referência externa,
  // que é o nosso pedidoId — o segundo cobre a notificação que chega antes
  // de a resposta síncrona ter sido salva.
  const pedido =
    buscarPedidoPorPagamentoId(resultado.idExterno) ??
    (resultado.referenciaExterna ? buscarPedido(resultado.referenciaExterna) : undefined);

  if (!pedido) {
    console.warn(`[webhook] pagamento ${resultado.idExterno} sem pedido correspondente`);
    return { desfecho: 'sem_pedido' };
  }

  // Idempotência: o MP reenvia. Só a primeira transição dispara a geração.
  if (pedido.status !== 'aguardando_pagamento') {
    return { desfecho: 'ja_processado' };
  }

  // A contagem dos 7 dias começa AGORA, no momento em que o pagamento
  // confirmou — não quando a geração terminar. Se o pipeline demorar ou
  // falhar e for reprocessado amanhã, a pessoa não pode perder um dia.
  const pagoEm = new Date();
  atualizarPedido(pedido.id, {
    status: 'pago',
    pagamento_id: resultado.idExterno,
    pago_em: pagoEm.toISOString(),
    expira_em: calcularExpiracao(produtoDe(pedido.produto), pagoEm),
    // O que o MP diz ter cobrado e repassado. Guardado no momento da
    // confirmação porque é a única hora em que temos a resposta dele em
    // mãos — depois exigiria uma consulta nova por pedido.
    bruto_centavos: resultado.brutoCentavos,
    taxa_centavos: resultado.taxaCentavos,
    liquido_centavos: resultado.liquidoCentavos,
    metodo_pagamento: resultado.metodo,
  });
  registrarEvento('pagamento_confirmado', pedido.id);

  // Sem `await` de propósito — ver o comentário em `ResultadoNotificacao.entrega`.
  const entrega = aposPagamento(pedido.id);

  return { desfecho: 'processado', entrega };
}
