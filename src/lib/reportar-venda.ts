import type { Pedido } from './db';
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
  return process.env.UTMIFY_PLATAFORMA ?? 'MercadoPago';
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

    await reportarPedido({
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
  } catch (erro) {
    console.error('[utmify] reportar venda falhou:', erro);
  }
}
