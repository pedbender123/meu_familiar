import db from './db';
import type { Pedido } from './db';
import { buscarCampanha, listarPecas } from './campanhas';
import { produtoVigenteDe } from './modelo-de-venda';
import { precoDoPedido } from './cupons';
import {
  reportarPedido,
  metodoParaUtmify,
  type StatusUtmify,
  type ParametrosDeRastreio,
} from './utmify';

/**
 * Traduz um pedido daqui para o que a Utmify espera, e manda.
 *
 * ── Por que uma função e não a chamada solta nos dois lugares ─────────────
 *
 * O pedido é reportado **duas vezes**: quando nasce (`waiting_payment`) e
 * quando é pago (`paid`). Escrever a tradução nos dois lugares é como um dos
 * dois passa a mandar o valor errado — e o erro só aparece semanas depois,
 * num relatório de campanha que ninguém confere linha a linha.
 *
 * ── Nunca lança ───────────────────────────────────────────────────────────
 *
 * Rastreio quebrado é um relatório com buraco; rastreio que lança é uma venda
 * perdida. As duas chamadas acontecem em caminhos que mexem com dinheiro.
 */
/**
 * A Wiven avisa a Utmify sozinha?
 *
 * ── A aposta que não se confirmou ─────────────────────────────────────────
 *
 * A conta da Wiven é ligada à Utmify por dentro, então em 24/08 a venda paga
 * por lá deixou de ser reportada por nós, para a mesma venda não entrar duas
 * vezes — a Utmify agrupa por `orderId`, e o id da Wiven não é o nosso
 * `pedidoId`.
 *
 * **Não funcionou.** A venda de 24/08 (pedido 1d53f3f6, R$ 18,90, paga pela
 * Wiven) não chegou à Utmify por caminho nenhum: nem pelo deles, nem pelo
 * nosso, porque o nosso estava desligado esperando o deles. Ficou invisível
 * nos dois painéis.
 *
 * Então o padrão inverteu: **reportamos sempre**. Venda contada duas vezes é
 * um número errado que alguém percebe e conserta; venda que não aparece em
 * lugar nenhum é uma campanha avaliada como se não tivesse vendido — e a
 * decisão que sai disso é pausar o que está funcionando.
 *
 * `UTMIFY_PULAR_WIVEN=1` volta ao comportamento anterior, se um dia a
 * integração nativa deles passar a valer.
 */
function gatewayJaReportaSozinho(
  gateway: string | null | undefined,
  status: StatusUtmify
): boolean {
  if (process.env.UTMIFY_PULAR_WIVEN !== '1') return false;
  // Mesmo pulando, só a venda paga: o pré-venda a Wiven nunca mandou, e é
  // ele que dá o denominador da conversão.
  return gateway === 'wiven' && status === 'paid';
}

/**
 * O nome da plataforma no relatório da Utmify.
 *
 * Estava fixo em `'Cakto'` — de quando a Cakto era o plano. Com o Mercado
 * Pago cobrando, toda venda aparecia no painel dela como se fosse da Cakto,
 * que nunca cobrou nada. Agora sai do gateway que REALMENTE cobrou aquele
 * pedido, gravado na tentativa.
 */
function plataformaDe(gateway: string | null | undefined): string {
  if (gateway === 'wiven') return 'Wiven';
  if (gateway === 'cakto') return 'Cakto';
  if (gateway === 'mercadopago') return 'MercadoPago';
  // `||` porque `UTMIFY_PLATAFORMA=` existe vazia em produção — ver utmify.ts.
  return process.env.UTMIFY_PLATAFORMA?.trim() || 'MercadoPago';
}

/**
 * O rastreio de uma venda que chegou sem UTM na URL.
 *
 * ── O buraco que isto tapa ────────────────────────────────────────────────
 *
 * O link do anúncio carrega duas coisas independentes: o nosso `?c=`, que
 * identifica campanha e peça aqui dentro, e os `utm_*`, que a Meta preenche.
 * Um anúncio pode ter o primeiro e não o segundo — e foi o que aconteceu com
 * a venda de 27/08.
 *
 * Sem UTM, a Utmify arquiva a venda como direta. Ela ENTRA no painel, mas
 * fora de qualquer campanha — que é o mesmo que sumir, para quem está olhando
 * o resultado de uma campanha específica.
 *
 * Nós sabemos de qual campanha e de qual peça a pessoa veio: está gravado no
 * pedido desde o primeiro toque. Faltava só dizer isso a eles.
 *
 * ── Por que reaproveitar o utm_campaign de outra venda ────────────────────
 *
 * A Meta manda o ID numérico da campanha (`120248890724340044`), não o nome.
 * Se aqui mandássemos "Comeccou!", a Utmify passaria a mostrar DUAS campanhas
 * para a mesma coisa — uma com o id, outra com o nome — e o resultado ficaria
 * dividido entre as duas.
 *
 * Então procuramos o id que a própria campanha já trouxe em alguma venda
 * anterior e usamos o mesmo. O nome só entra quando ela nunca recebeu um UTM
 * na vida, e aí não há identidade prévia para conflitar.
 */
/**
 * Os três campos que bastam para saber de qual anúncio a venda veio.
 *
 * Não é `Pedido` porque assinatura não é pedido: `cobrancas` guarda os mesmos
 * três desde a migração 038, e a tradução para a UTMify é idêntica. Repetir a
 * função para a outra tabela seria garantir que uma das duas passe a mandar o
 * `utm_campaign` errado sem ninguém notar.
 */
export interface VendaAtribuida {
  campanha_id: string | null;
  peca_id: string | null;
  origem: string | null;
}

export function rastreioDaCampanha(venda: VendaAtribuida): ParametrosDeRastreio {
  const campanha = venda.campanha_id ? buscarCampanha(venda.campanha_id) : undefined;
  if (!campanha) return {};

  const peca = venda.peca_id
    ? listarPecas(campanha.id).find((p) => p.id === venda.peca_id)
    : undefined;

  /**
   * O identificador que esta campanha já usou na Utmify, se usou algum.
   *
   * A resposta boa está em `campanha.utm_campanha`: o ID cru que a Meta
   * mandou no link, guardado no momento em que a campanha nasceu. Reportar
   * ELE é reportar exatamente a string que a plataforma deles conhece.
   *
   * Traduzir para o nome interno é o que cria duas identidades para a mesma
   * campanha no painel de quem compra a mídia — uma com o ID, vinda dos
   * cliques, outra com o nome, vinda das nossas vendas — e aí nenhuma das
   * duas fecha a conta sozinha.
   *
   * A varredura no histórico abaixo continua como rede: ela cobre as
   * campanhas antigas, cadastradas à mão antes de `utm_campanha` existir.
   */
  let idDaCampanha: string | null = campanha.utm_campanha ?? null;

  if (!idDaCampanha) {
    try {
      const anterior = db
        .prepare(
          `SELECT utm_json FROM pedidos
            WHERE campanha_id = ? AND utm_json IS NOT NULL AND length(utm_json) > 2
            ORDER BY criado_em DESC LIMIT 1`
        )
        .get(campanha.id) as { utm_json: string } | undefined;
      if (anterior) {
        idDaCampanha =
          (JSON.parse(anterior.utm_json) as ParametrosDeRastreio).utm_campaign ?? null;
      }
    } catch {
      // Sem histórico utilizável, cai no nome da campanha.
    }
  }

  return {
    utm_source: venda.origem ?? 'desconhecido',
    utm_medium: 'paid',
    utm_campaign: idDaCampanha ?? campanha.nome,
    /*
      A peça é o criativo — é o que responde "qual vídeo trouxe esta venda".

      Quando ela nasceu do anúncio, o `utm_conteudo` é o `{{ad.id}}` cru e vai
      cru: é assim que o criativo aparece no painel deles com o mesmo nome que
      tem no gerenciador. `codigo-nome` fica para as peças cadastradas à mão,
      que nunca tiveram ID da Meta nenhum.
    */
    utm_content: peca ? (peca.utm_conteudo ?? `${peca.codigo}-${peca.nome}`) : undefined,
  };
}

export async function reportarVenda(
  pedido: Pedido,
  status: StatusUtmify,
  extras: { taxaCentavos?: number | null; metodo?: string | null; aprovadoEm?: Date } = {}
): Promise<void> {
  try {
    if (!pedido.email) return;

    if (gatewayJaReportaSozinho(pedido.gateway, status)) {
      console.log(
        `[utmify] venda paga do pedido ${pedido.id} não reportada: a Wiven ` +
          'avisa sozinha (UTMIFY_REPORTAR_WIVEN=1 força o envio)'
      );
      return;
    }

    /**
     * `produtoVigente`, não a tabela estática — mesma regra de todo lugar que
     * lida com preço. Aqui o estrago seria silencioso: a Revelação está com
     * `precoCentavos: 0` em `produtos.ts`, e uma venda reportada com valor
     * zero faz o ROAS de toda a campanha parecer infinito.
     */
    const produto = produtoVigenteDe(pedido.produto);
    /**
     * O valor cobrado de verdade quando ele existe (`bruto_centavos`, gravado
     * pelo gateway), e o de tabela só como último recurso. Mandar o preço
     * cheio de uma venda com desconto infla a receita de toda campanha.
     */
    const valorCentavos = pedido.bruto_centavos ?? precoDoPedido(pedido).finalCentavos;

    let rastreio: ParametrosDeRastreio = {};
    try {
      if (pedido.utm_json) rastreio = JSON.parse(pedido.utm_json);
    } catch {
      // UTM malformado não pode impedir a venda de ser reportada.
    }

    if (!rastreio.utm_campaign && pedido.campanha_id) {
      rastreio = { ...rastreio, ...rastreioDaCampanha(pedido) };
    }

    /**
     * O lucro DELES, não o bolo da venda.
     *
     * Quem lê o painel da Utmify é a agência, e o número que sustenta a
     * decisão de escalar ou pausar é "quanto entra para nós por venda". Da
     * venda saem três coisas antes disso: a taxa do gateway, e a fatia do
     * dono da plataforma. Nenhuma das duas é resultado da campanha deles.
     *
     * O que sobra — a conta que cobrou mais o sócio dela — é o que vai como
     * comissão. E a diferença entre o preço e esse número vai como taxa: é
     * tudo que foi retirado antes do lucro, que é a leitura correta do ponto
     * de vista de quem recebe.
     */
    const retiradoCentavos =
      (extras.taxaCentavos ?? pedido.taxa_centavos ?? 0) +
      (pedido.split_do_dono_centavos ?? 0);

    const aceito = await reportarPedido({
      plataforma: plataformaDe(pedido.gateway),
      retiradoCentavos,
      orderId: pedido.id,
      status,
      metodo: metodoParaUtmify(extras.metodo ?? pedido.metodo_pagamento),
      criadoEm: new Date(pedido.criado_em),
      aprovadoEm: extras.aprovadoEm ?? (pedido.pago_em ? new Date(pedido.pago_em) : null),
      cliente: {
        nome: pedido.nome,
        email: pedido.email,
        ip: pedido.ip_comprador,
      },
      produto: {
        id: produto.id,
        nome: produto.nome,
        precoCentavos: valorCentavos,
      },
      taxaCentavos: extras.taxaCentavos ?? pedido.taxa_centavos ?? 0,
      rastreio,
    });

    anotarEnvio(pedido.id, aceito ? null : `${status} recusado ou sem resposta`);
  } catch (erro) {
    console.error('[utmify] reportar venda falhou:', erro);
    anotarEnvio(pedido.id, String(erro).slice(0, 200));
  }
}

/**
 * Grava o resultado do envio no próprio pedido.
 *
 * ── Por que isto não podia ficar só no log ────────────────────────────────
 *
 * A arquitetura escolhida é: a Wiven avisa a NÓS, e nós avisamos a UTMify.
 * Isso é verdade e funciona — mas põe o relatório inteiro da agência
 * dependendo deste envio dar certo. Enquanto o resultado morria no
 * `console`, "a UTMify está recebendo" era uma afirmação que ninguém
 * conseguia conferir sem abrir log e saber o que procurar.
 *
 * Com isto gravado, a tela de Saúde responde sozinha, e a resposta sobrevive
 * ao log rotacionar.
 *
 * ── Por que ela nunca deixa exceção subir ─────────────────────────────────
 *
 * Roda dentro do webhook do gateway, no mesmo caminho que ENTREGA o produto.
 * Falhar ao anotar um diagnóstico não pode custar a entrega de quem pagou.
 */
function anotarEnvio(pedidoId: string, erro: string | null): void {
  try {
    db.prepare(
      `UPDATE pedidos
          SET utmify_em = CASE WHEN @erro IS NULL THEN @agora ELSE utmify_em END,
              utmify_erro = @erro
        WHERE id = @id`
    ).run({ id: pedidoId, agora: new Date().toISOString(), erro });
  } catch (e) {
    console.error('[utmify] não consegui anotar o envio:', e);
  }
}
