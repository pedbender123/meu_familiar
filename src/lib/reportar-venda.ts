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
 * Quem já avisa a Utmify sozinho — e sobre O QUÊ.
 *
 * ── A divisão de trabalho com a Wiven ─────────────────────────────────────
 *
 * A conta da Wiven é ligada à Utmify por dentro, e o que ela manda é a VENDA
 * PAGA. Se a gente mandasse também, a mesma venda entraria duas vezes: a
 * Utmify agrupa por `orderId`, e o id da Wiven não é o nosso `pedidoId` —
 * seriam dois pedidos com o mesmo dinheiro. Receita inflada, ROAS inflado,
 * campanha escalada por um número que não existe.
 *
 * Mas ela **não manda o pré-venda**. E é o pré-venda que dá o denominador:
 * sem `waiting_payment`, o painel mostra as vendas e nada de quem chegou ao
 * checkout e desistiu — não existe taxa de conversão com numerador só.
 *
 * Então a divisão é por ESTÁGIO, não por gateway:
 *
 *   `waiting_payment` → nós, sempre, em qualquer gateway
 *   `paid`            → nós, exceto na Wiven, que já manda
 *
 * `UTMIFY_REPORTAR_WIVEN=1` devolve os dois para a gente, caso a integração
 * nativa deles não esteja valendo. Duas fontes é ruim; nenhuma é pior.
 */
function gatewayJaReportaSozinho(
  gateway: string | null | undefined,
  status: StatusUtmify
): boolean {
  if (process.env.UTMIFY_REPORTAR_WIVEN === '1') return false;
  // Só a venda paga. O pré-venda a Wiven não manda, e é ele que dá o
  // denominador da conversão.
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

    await reportarPedido({
      plataforma: plataformaDe(pedido.gateway),
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
