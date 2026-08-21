import { PRODUTOS, type ProdutoId } from './produtos';

/**
 * O preço, num lugar só.
 *
 * ── Por que existe uma função e não `produto.precoCentavos` espalhado ─────
 *
 * A tela de pagamento, a chamada ao gateway e o painel passam todos por aqui.
 * É o que impede o caso clássico de a vitrine mostrar um valor e a cobrança
 * sair outro — e ele acontece sempre que duas partes do código calculam o
 * mesmo número por conta própria.
 */

/**
 * Abaixo disto, cobrar não vale a pena: a taxa do gateway come tudo e o
 * pagamento costuma ser recusado. Vira entrega direta, sem passar pelo
 * gateway — mandar R$ 0,00 para um provedor de pagamento não é "grátis", é
 * uma cobrança recusada.
 */
export const PISO_COBRAVEL_CENTAVOS = 100;

export interface PrecoFinal {
  cheioCentavos: number;
  finalCentavos: number;
  descontoPercentual: number;
  gratis: boolean;
}

export function precoComDesconto(
  /**
   * Só o preço importa. Pedir um `Produto` inteiro obrigaria quem cobra
   * qualquer outra coisa a fabricar um produto de mentira, com campos que não
   * significam nada numa conta de desconto.
   */
  produto: { precoCentavos: number },
  descontoPercentual = 0
): PrecoFinal {
  const pct = Math.max(0, Math.min(100, Math.round(descontoPercentual)));
  const cheio = produto.precoCentavos;

  /**
   * Arredonda para CIMA: 20% de R$ 14,90 dá R$ 11,92 e não R$ 11,91. Centavo
   * a menos no nosso bolso é irrelevante; centavo a mais é cobrança indevida.
   */
  const final = Math.ceil(cheio * (1 - pct / 100));

  return {
    cheioCentavos: cheio,
    finalCentavos: final < PISO_COBRAVEL_CENTAVOS ? 0 : final,
    descontoPercentual: pct,
    gratis: final < PISO_COBRAVEL_CENTAVOS,
  };
}

/** O preço de um pedido, lido do que ficou gravado nele. */
export function precoDoPedido(pedido: {
  produto: string;
  desconto_percentual: number | null;
}): PrecoFinal {
  const produto = PRODUTOS[pedido.produto as ProdutoId] ?? PRODUTOS.revelacao;
  return precoComDesconto(produto, pedido.desconto_percentual ?? 0);
}
