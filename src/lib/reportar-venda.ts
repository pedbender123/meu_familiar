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
export async function reportarVenda(
  pedido: Pedido,
  status: StatusUtmify,
  extras: { taxaCentavos?: number | null; metodo?: string | null; aprovadoEm?: Date } = {}
): Promise<void> {
  try {
    if (!pedido.email) return;

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
