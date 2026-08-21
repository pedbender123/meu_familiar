import {
  buscarPedido,
  buscarPedidoPorPagamentoId,
  buscarPedidoAguardandoPorEmail,
  atualizarPedido,
  registrarEvento,
} from './db';
import { statusLiberaAcesso } from '../nucleo/checkouts/directpag';
import type { ResultadoPagamento } from '../nucleo/checkouts/tipos';
import { calcularExpiracao, produtoDe } from './produtos';
import { aposPagamento } from './processar';
import { reportarVenda } from './reportar-venda';

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
/**
 * Acha o pedido de uma venda, por todos os caminhos possíveis.
 *
 * ── Por que três tentativas e não uma ─────────────────────────────────────
 *
 * A venda pode nascer de dois jeitos, e eles guardam a referência em lugares
 * diferentes:
 *
 *  1. **Pelo nosso checkout** — a transação já nasce com `pagamento_id`
 *     gravado no pedido, então a primeira busca resolve.
 *  2. **Pelo checkout hospedado do DirectPag** (o modo "área de membros
 *     externa") — aqui o `pagamento_id` nunca foi gravado, e o que liga a
 *     venda ao pedido é a referência externa.
 *
 * A terceira tentativa, pelo e-mail, é a rede de segurança: se a referência
 * se perder no caminho — e ela se perde, porque nem toda plataforma repassa
 * campo customizado — sobra o endereço de quem comprou. Ele acha o pedido
 * mais recente daquela pessoa que ainda está esperando pagamento.
 *
 * É deliberadamente a ÚLTIMA opção e só olha pedidos em
 * `aguardando_pagamento`: casar por e-mail é palpite, e um palpite não pode
 * sobrescrever um pedido já entregue.
 */
function acharPedidoDaVenda(resultado: ResultadoPagamento) {
  const porPagamento = buscarPedidoPorPagamentoId(resultado.idExterno);
  if (porPagamento) return porPagamento;

  if (resultado.referenciaExterna) {
    const porReferencia = buscarPedido(resultado.referenciaExterna);
    if (porReferencia) return porReferencia;
  }

  if (resultado.emailDoPagador) {
    return buscarPedidoAguardandoPorEmail(resultado.emailDoPagador);
  }

  return undefined;
}

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
  // Casa por `pagamento_id` (gravado na criação) ou pela referência externa,
  // que é o nosso pedidoId — o segundo cobre a notificação que chega antes
  // de a resposta síncrona ter sido salva.
  const pedido = acharPedidoDaVenda(resultado);

  if (!pedido) {
    /**
     * Pagamento sem pedido é **dinheiro recebido e produto não entregue**.
     * Vira anomalia alta em vez de só um aviso no log: é o tipo de coisa que
     * ninguém descobre olhando gráfico, só quando a pessoa reclama — e a
     * essa altura já passaram dias.
     *
     * `npm run reconciliar` varre o gateway e reprocessa estes casos.
     */
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

  /**
   * A venda confirmada vai para a Utmify. É o envio que fecha o relatório de
   * campanha: `waiting_payment` saiu quando a cobrança abriu, e este marca
   * quem de fato pagou.
   *
   * Sem `await` de propósito — este handler precisa responder rápido ao
   * gateway, e uma linha de relatório atrasada é melhor que uma notificação
   * que o gateway considera falha e retenta.
   */
  void reportarVenda(buscarPedido(pedido.id)!, 'paid', {
    taxaCentavos: resultado.taxaCentavos,
    metodo: resultado.metodo,
    aprovadoEm: pagoEm,
  });


  /**
   * **A venda é contada AQUI, e só aqui.**
   *
   * Disciplina 6 do projeto — "o pixel nunca depende do navegador" — levada
   * até o fim: o navegador não dispara mais `Purchase` em lugar nenhum. Ele
   * não sabe quantas vezes já contou, porque a memória dele é `localStorage`
   * e ela é por navegador. Este ponto sabe: o pagamento confirma uma vez.
   *
   * `registrarCompra` enfileira em vez de mandar direto — enfileirar é uma
   * escrita local rápida e este handler precisa responder rápido ao Mercado
   * Pago; quem fala com a rede é `processarFilaCapi()` (`npm run capi`).
   */
  /**
   * O `Purchase` também sai do servidor, com o MESMO `event_id` que o
   * navegador usa (`${pedido.id}:purchase`). É o que deixa a Meta contar uma
   * venda quando os dois chegam.
   *
   * Só enfileira com o pixel configurado: sem ele a fila acumularia eventos
   * que nunca vão sair.
   */

  // Sem `await` de propósito — ver o comentário em `ResultadoNotificacao.entrega`.
  const entrega = aposPagamento(pedido.id);

  return { desfecho: 'processado', entrega };
}
