import {
  buscarPedido,
  buscarPedidoPorPagamentoId,
  atualizarPedido,
  registrarEvento,
} from './db';
import { statusLiberaAcesso, type ResultadoPagamento } from '../nucleo/checkouts/mercadopago';
import {
  buscarCobranca,
  buscarCobrancaPorPagamento,
  confirmarPagamento,
} from '../nucleo/cobrancas';
import { calcularExpiracao, produtoDe } from './produtos';
import { aposPagamento } from './processar';
import { checarEmLinha } from '../nucleo/sentinela/emLinha';
import { checarValorCobrado } from '../nucleo/sentinela/invariantes/financeiro';
import { enfileirarEventoCapi } from './fila-capi';
import { entregarChaveDaPlataforma, nomeDaConta } from './acesso-plataforma';

export type DesfechoNotificacao =
  | 'nao_libera_acesso'
  | 'sem_pedido'
  | 'ja_processado'
  | 'processado'
  /** Pagamento de PLANO (tabela `cobrancas`), não de ritual. */
  | 'assinatura_confirmada';

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

  /**
   * **Cobrança de plano vem antes**, e por um motivo prático: ela e o pedido
   * de ritual vivem em tabelas diferentes, e o mesmo webhook atende os dois.
   * Se a busca por pedido rodasse primeiro, uma cobrança de assinatura cairia
   * no `sem_pedido` e o pagamento ficaria órfão — a pessoa pagaria e não
   * ganharia plano nenhum.
   */
  const cobranca =
    buscarCobrancaPorPagamento(resultado.idExterno) ??
    (resultado.referenciaExterna ? buscarCobranca(resultado.referenciaExterna) : undefined);

  if (cobranca) {
    const confirmada = confirmarPagamento(cobranca.id, {
      metodo: resultado.metodo,
      brutoCentavos: resultado.brutoCentavos,
      taxaCentavos: resultado.taxaCentavos,
      liquidoCentavos: resultado.liquidoCentavos,
    });
    registrarEvento(
      confirmada?.assinatura ? 'assinatura_confirmada' : 'assinatura_ja_confirmada'
    );

    /**
     * **Quem pagou entra agora.**
     *
     * A pessoa que compra na tela de oferta não tem sessão — ela acabou de
     * sair do ritual e nunca fez login. Sem este e-mail ela pagaria, seria
     * mandada para `/conta` e cairia na tela de entrar, sem nada que a
     * ligasse ao que acabou de comprar. Era o beco sem saída do funil novo.
     *
     * Só na PRIMEIRA confirmação (`confirmada?.assinatura`): o Mercado Pago
     * reenvia a notificação, e reenviar o link mágico a cada repetição
     * encheria a caixa de entrada de quem só comprou uma vez.
     */
    if (confirmada?.assinatura) {
      await entregarChaveDaPlataforma({
        email: cobranca.email,
        nome: nomeDaConta(cobranca.email),
        contaNova: false,
      });
    }

    return { desfecho: 'assinatura_confirmada' };
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

  // Vigilância em linha: confere, no instante em que o pagamento é gravado,
  // se o valor bate com produto e cupom (docs/reestruturacao.md §5). Falha
  // aberto — nunca atrasa nem derruba a entrega.
  checarEmLinha('valor_cobrado', () => checarValorCobrado(buscarPedido(pedido.id)!));

  /**
   * Disciplina 6: "o pixel nunca depende do navegador". Enfileira aqui — não
   * manda direto — porque enfileirar é uma escrita local rápida (nunca toca
   * a Meta) e este handler precisa responder rápido ao Mercado Pago; quem
   * fala com a rede é `processarFilaCapi()`, à parte (`npm run capi`).
   *
   * `eventId: ${pedido.id}:purchase` é a MESMA chave que `MarcaCompra.tsx`
   * manda pro pixel do navegador — é o que deixa a Meta deduplicar os dois
   * em vez de contar a venda duas vezes.
   *
   * Só enfileira com o pixel configurado: sem `NEXT_PUBLIC_META_PIXEL_ID` (dev,
   * ou enquanto a chave não chega) a fila acumularia eventos que nunca vão
   * sair e a Sentinela acabaria gritando falso alarme de "falhou definitivo".
   */
  if (process.env.NEXT_PUBLIC_META_PIXEL_ID) {
    enfileirarEventoCapi({
      pedidoId: pedido.id,
      nome: 'Purchase',
      quando: pagoEm,
      email: pedido.email || undefined,
      valorEmReais: resultado.brutoCentavos !== null ? resultado.brutoCentavos / 100 : undefined,
      eventId: `${pedido.id}:purchase`,
    });
  }

  // Sem `await` de propósito — ver o comentário em `ResultadoNotificacao.entrega`.
  const entrega = aposPagamento(pedido.id);

  return { desfecho: 'processado', entrega };
}
