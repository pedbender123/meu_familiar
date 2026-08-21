import type { Pedido } from '../../../lib/db';
import { precoDoPedido } from '../../../lib/cupons';
import type { Anomalia } from '../tipos';

/**
 * `valor_cobrado == preço_do_plano − desconto_do_cupom`, e não mais que isso.
 *
 * A regra que originou a Sentinela: "compra sem registro de valor e sem
 * cupom é indício de vulnerabilidade ou alguém mexendo direto no sistema".
 * Como invariante ela cobre mais que o caso que a inspirou — qualquer
 * caminho que marque um pedido como pago sem ele ter passado pelo webhook
 * (`webhook-pagamento.ts`) OU pelo desconto de 100% (`escolher/route.ts`)
 * cai aqui, **inclusive um que ninguém previu ainda**.
 *
 * ── Os dois jeitos legítimos de "pago" ──────────────────────────────────
 *
 * 1. Passou pelo Mercado Pago: `bruto_centavos` bate com o preço do produto
 *    menos o desconto do cupom gravado no pedido.
 * 2. Cupom de 100%: preço zero não vai ao gateway (ele recusaria), então
 *    `bruto_centavos` fica `null` de propósito — e isso É o esperado, não
 *    uma anomalia.
 *
 * Qualquer coisa fora desses dois formatos é a invariante quebrando.
 */
export function checarValorCobrado(pedido: Pedido): Anomalia | null {
  // Nunca foi pago: nada a checar ainda — `bruto_centavos` null aqui é normal.
  if (!pedido.pago_em) return null;

  const preco = precoDoPedido(pedido);

  if (preco.gratis) {
    // Dispensado de propósito por cupom de 100%. Só é anomalia se, apesar
    // disso, ALGUM valor foi cobrado — sinal de um cupom que devia ter
    // zerado o preço mas não zerou, ou de um valor sendo gravado por engano
    // num pedido que nunca deveria tocar o gateway.
    if (pedido.bruto_centavos !== null && pedido.bruto_centavos !== 0) {
      return {
        invariante: 'valor_cobrado_bate_com_produto_e_cupom',
        severidade: 'critico',
        entidadeTipo: 'pedido',
        entidadeId: pedido.id,
        esperado: 'sem cobrança — cupom de 100% dispensa o gateway',
        encontrado: `${pedido.bruto_centavos} centavos cobrados mesmo assim`,
        contexto: { produto: pedido.produto, cupom: pedido.cupom },
      };
    }
    return null;
  }

  // Devia ter passado pelo Mercado Pago e ter um valor batendo com o preço.
  if (pedido.bruto_centavos === null) {
    return {
      invariante: 'valor_cobrado_bate_com_produto_e_cupom',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: pedido.id,
      esperado: `${preco.finalCentavos} centavos cobrados (produto ${pedido.produto}${
        pedido.cupom ? `, cupom ${pedido.cupom}` : ''
      })`,
      encontrado: 'pago_em preenchido, mas nenhum valor foi registrado — nem cupom de 100% que justifique',
      contexto: { produto: pedido.produto, cupom: pedido.cupom, descontoPercentual: pedido.desconto_percentual },
    };
  }

  if (pedido.bruto_centavos !== preco.finalCentavos) {
    return {
      invariante: 'valor_cobrado_bate_com_produto_e_cupom',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: pedido.id,
      esperado: `${preco.finalCentavos} centavos`,
      encontrado: `${pedido.bruto_centavos} centavos`,
      contexto: { produto: pedido.produto, cupom: pedido.cupom, descontoPercentual: pedido.desconto_percentual },
    };
  }

  return null;
}

/**
 * Acesso sem origem: conta com direito ativo que nenhuma assinatura/pedido
 * dela concede.
 *
 * A forma geral do exemplo acima — qualquer caminho que libere acesso sem
 * pagamento cai aqui, inclusive um que ninguém previu. Hoje, sem o núcleo de
 * assinaturas (Fase 2), a checagem equivalente é: toda CONTA com pedido
 * `entregue` tem, para aquele pedido, um `pago_em` não nulo. Vira mais rica
 * quando `assinaturas` existir.
 */
export function checarEntregaTemPagamento(pedido: Pedido): Anomalia | null {
  if (pedido.status !== 'entregue') return null;
  if (pedido.exemplo === 1) return null; // amostra do mural, não é cliente

  if (!pedido.pago_em) {
    return {
      invariante: 'entrega_sem_pagamento',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: pedido.id,
      esperado: 'pedido entregue tem pago_em preenchido',
      encontrado: 'pago_em está vazio',
      contexto: { produto: pedido.produto, email: pedido.email },
    };
  }

  return null;
}
