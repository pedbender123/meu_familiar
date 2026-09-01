import {
  buscarPedido,
  buscarPedidoPorPagamentoId,
  atualizarPedido,
  registrarEvento,
} from './db';
import { statusLiberaAcesso, type ResultadoPagamento } from '../nucleo/checkouts/mercadopago';
import { buscarPlano } from '../nucleo/planos';
import {
  buscarCobranca,
  buscarCobrancaPorPagamento,
  cobrancaDoContrato,
  confirmarPagamento,
  anotarAcessoEnviado,
  ligarAssinaturaAoContrato,
  registrarRenovacao,
  renovarAssinatura,
} from '../nucleo/cobrancas';
import { calcularExpiracao, produtoDe } from './produtos';
import { aposPagamento } from './processar';
import { checarEmLinha } from '../nucleo/sentinela/emLinha';
import { checarValorCobrado } from '../nucleo/sentinela/invariantes/financeiro';
import { registrarCompra } from '../nucleo/eventos-meta';
import { entregarChaveDaPlataforma, nomeDaConta } from './acesso-plataforma';
import { buscarPedidoPorMelhoria, confirmarMelhoria } from '../nucleo/melhoria';
import { reportarVenda } from './reportar-venda';
import { reportarAssinatura } from './reportar-assinatura';

export type DesfechoNotificacao =
  | 'nao_libera_acesso'
  | 'sem_pedido'
  | 'ja_processado'
  | 'processado'
  /** Pagamento de PLANO (tabela `cobrancas`), não de ritual. */
  | 'assinatura_confirmada'
  /** A cobrança do mês seguinte, que ESTENDE o acesso em vez de criá-lo. */
  | 'assinatura_renovada';

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
  /**
   * O terceiro caminho: a RENOVAÇÃO de uma assinatura recorrente.
   *
   * ── Por que os dois primeiros não bastam ────────────────────────────────
   *
   * A cobrança do segundo mês chega com um `transactionId` que a gente nunca
   * viu, e com um `identifier` que **não é o nosso** — medido na primeira
   * assinatura real:
   *
   *     app.wiven.com.br-SUBSCRIPTION-<pedido>-<contrato>
   *
   * Os dois caminhos de cima erram, e o pagamento cairia em `sem_pedido`:
   * dinheiro cobrado do cliente, acesso vencendo no dia seguinte, e nada no
   * sistema explicando por quê.
   */
  const cobranca =
    buscarCobrancaPorPagamento(resultado.idExterno) ??
    (resultado.referenciaExterna ? buscarCobranca(resultado.referenciaExterna) : undefined) ??
    cobrancaDoContrato(resultado.identificadorBruto);

  /*
    Cobrança JÁ paga com dinheiro novo entrando é renovação, não repetição do
    webhook. `confirmarPagamento` é idempotente de propósito — passar por lá
    faria a renovação não fazer nada, e o acesso venceria com o cliente em dia.
  */
  if (cobranca?.status === 'pago' && cobranca.assinatura_externa_id) {
    const plano = buscarPlano(cobranca.plano_id);
    const renovada = plano?.duracao_dias
      ? renovarAssinatura(
          cobranca.assinatura_externa_id,
          plano.duracao_dias,
          resultado.idExterno
        )
      : null;

    if (renovada) {
      registrarEvento('assinatura_renovada', cobranca.id);
      console.log(
        `[webhook] assinatura ${cobranca.assinatura_externa_id} renovada até ${renovada.fim}`
      );

      /**
       * **O mês novo vira uma linha de receita, e chega à UTMify.**
       *
       * Antes disto a renovação empurrava a data de fim e sumia: nenhum
       * valor, nenhuma data, nenhuma transação no banco. Um assinante de seis
       * meses tinha uma única venda registrada — a de seis meses atrás — e a
       * agência media o retorno da campanha sobre um sexto do que ela trouxe.
       *
       * A linha nasce herdando a atribuição da cobrança original: a campanha
       * que trouxe a pessoa é a mesma que está pagando o sexto mês.
       *
       * `registrarRenovacao` devolve `null` quando esta transação já virou
       * linha — reenvio do webhook não pode virar receita dobrada, do mesmo
       * jeito que já não vira mês de graça.
       */
      const linha = registrarRenovacao(cobranca, {
        transacaoExterna: resultado.idExterno,
        assinaturaId: renovada.id,
        metodo: resultado.metodo,
        brutoCentavos: resultado.brutoCentavos,
        taxaCentavos: resultado.taxaCentavos,
        liquidoCentavos: resultado.liquidoCentavos,
      });

      if (linha) {
        // Sem `await`: o gateway tem 8 segundos para receber a resposta.
        void reportarAssinatura(linha, 'paid', {
          metodo: resultado.metodo,
          taxaCentavos: resultado.taxaCentavos,
          aprovadoEm: new Date(linha.pago_em!),
        });
      }

      return { desfecho: 'assinatura_renovada' };
    }
  }

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
    /*
      Liga a assinatura ao contrato do gateway assim que ela nasce. Sem este
      vínculo, a renovação do mês seguinte acha a cobrança e não acha a
      assinatura para estender.
    */
    if (confirmada?.assinatura && cobranca.assinatura_externa_id) {
      ligarAssinaturaAoContrato(
        confirmada.assinatura.id,
        cobranca.assinatura_externa_id,
        resultado.idExterno
      );
    }

    if (confirmada?.assinatura) {
      /*
        A entrega é aguardada aqui — diferente do funil de produto, onde a
        geração roda solta. Aqui não há nada para gerar: é um e-mail, e saber
        se ele saiu é metade da pergunta que a tela de assinantes responde.
      */
      const entregue = await entregarChaveDaPlataforma({
        email: cobranca.email,
        nome: nomeDaConta(cobranca.email),
        contaNova: false,
      });
      if (entregue) anotarAcessoEnviado(cobranca.id);

      /**
       * **A venda de plano também é venda.**
       *
       * O `Purchase` só existia no ramo do pedido, mais abaixo — e cobrança de
       * plano retorna aqui, antes de chegar lá. Resultado: desde que o modelo
       * virou assinatura, NENHUMA receita nova chegava à Meta. A campanha
       * otimizava por um funil que parou de ser o que vende, e o Ads Manager
       * mostrava um faturamento que não era o real.
       *
       * `cobranca.id` no lugar do pedido: `fila_capi.pedido_id` não tem chave
       * estrangeira, e é o id da cobrança que identifica esta venda de ponta a
       * ponta — o mesmo que `MarcoDoCheckout` usou no `InitiateCheckout`.
       *
       * Só na primeira confirmação, como o e-mail: o `ON CONFLICT(event_id)`
       * já protegeria contra duplicata, mas depender disso é deixar a
       * idempotência num detalhe de índice em vez de na lógica.
       */
      registrarCompra({
        referencia: cobranca.id,
        email: cobranca.email,
        valorEmReais:
          resultado.brutoCentavos !== null
            ? resultado.brutoCentavos / 100
            : cobranca.valor_centavos / 100,
      });

      /**
       * **E para a UTMify, que é quem a agência lê.**
       *
       * Este ramo retorna antes de chegar ao `reportarVenda` do pedido, lá
       * embaixo — então até aqui NENHUMA assinatura tinha sido reportada,
       * nunca. A de 01/09, a primeira paga de verdade, não apareceu no painel
       * deles por caminho nenhum.
       *
       * A cobrança relida do banco, e não a de cima: `confirmarPagamento`
       * acabou de gravar `pago_em`, método e valores, e é isso que precisa ir.
       */
      void reportarAssinatura(confirmada?.cobranca ?? cobranca, 'paid', {
        metodo: resultado.metodo,
        taxaCentavos: resultado.taxaCentavos,
      });
    }

    return { desfecho: 'assinatura_confirmada' };
  }

  /**
   * **A melhoria vem antes**, e a ordem aqui não é estética.
   *
   * O pedido de uma melhoria já está `entregue` e já tem `pagamento_id` — o da
   * compra original. Se a busca normal rodasse primeiro, ela acharia esse
   * pedido, veria que ele não está mais em `aguardando_pagamento`, e a
   * idempotência descartaria a notificação como reenvio.
   *
   * O resultado seria uma pessoa que pagou a melhoria e continuou com a
   * leitura curta — sem nenhum erro em log, porque tecnicamente nada falhou.
   */
  const daMelhoria = buscarPedidoPorMelhoria(resultado.idExterno);
  if (daMelhoria) {
    const { aplicou, entrega } = await confirmarMelhoria(daMelhoria.id, {
      brutoCentavos: resultado.brutoCentavos,
    });
    /**
     * `entrega` sai SEM `await`, igual ao caminho da compra normal logo
     * abaixo. Segurar a resposta pelo tempo da regeneração foi o que deixou
     * uma cliente presa em `gerando` por dez horas em 21/08 — ver o comentário
     * em `confirmarMelhoria`.
     */
    return { desfecho: aplicou ? 'processado' : 'ja_processado', entrega };
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
  registrarCompra({
    referencia: pedido.id,
    email: pedido.email ?? '',
    valorEmReais: resultado.brutoCentavos !== null ? resultado.brutoCentavos / 100 : undefined,
    quando: pagoEm,
  });

  /**
   * **A venda paga, para a Utmify.**
   *
   * Aqui, e não na tela de obrigado: quem sabe que o dinheiro entrou é este
   * ponto, e ele sabe uma vez só — a idempotência acima já garantiu que
   * qualquer reenvio do gateway parou em `ja_processado`.
   *
   * A receita vai **líquida** (`taxa_centavos` desce do bruto dentro de
   * `reportarVenda`). Mandar o valor cheio infla o resultado de toda campanha
   * e faz o CPA parecer melhor do que é — com a taxa fixa de R$ 2,49 da
   * Cakto num ticket de treze reais, a diferença é de quase 20%.
   *
   * Sem `await`, como a entrega: este handler tem 8 segundos para responder.
   */
  void reportarVenda(buscarPedido(pedido.id)!, 'paid', {
    metodo: resultado.metodo,
    taxaCentavos: resultado.taxaCentavos,
    aprovadoEm: pagoEm,
  });

  // Sem `await` de propósito — ver o comentário em `ResultadoNotificacao.entrega`.
  const entrega = aposPagamento(pedido.id);

  return { desfecho: 'processado', entrega };
}
