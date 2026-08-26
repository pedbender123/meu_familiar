/**
 * Utmify — o rastreio de venda por campanha.
 *
 * ── Duas metades, e as duas são necessárias ───────────────────────────────
 *
 * 1. **No navegador**, o script deles captura os UTMs da URL do anúncio e os
 *    guarda enquanto a pessoa navega. Sem isso não há o que reportar.
 * 2. **No servidor**, esta função avisa a Utmify quando o pedido nasce e
 *    quando ele é pago, com os UTMs que vieram junto.
 *
 * A segunda metade não pode sair do navegador: quem sabe que o pagamento
 * confirmou é o webhook do gateway, e nesse momento não há aba aberta.
 *
 * ── O status importa, não só a venda ──────────────────────────────────────
 *
 * A Utmify quer o pedido **duas vezes**: `waiting_payment` quando ele nasce e
 * `paid` quando o dinheiro entra. É assim que o painel dela calcula taxa de
 * conversão por campanha — mandar só a venda paga esconde quem chegou ao
 * checkout e desistiu, que é metade da informação útil.
 *
 * ── Falhar aqui nunca derruba uma venda ───────────────────────────────────
 *
 * Toda chamada engole o erro e loga. Rastreio quebrado é um relatório com
 * buraco; rastreio que lança é uma compra perdida.
 */

import { meioDe } from '../nucleo/checkouts/gateway';

const ENDPOINT = 'https://api.utmify.com.br/api-credentials/orders';

export type StatusUtmify =
  | 'waiting_payment'
  | 'paid'
  | 'refused'
  | 'refunded'
  | 'chargedback';

/** Os métodos que a Utmify aceita, nos nomes dela. */
export type MetodoUtmify = 'pix' | 'boleto' | 'credit_card' | 'paypal' | 'free_price';

export interface ParametrosDeRastreio {
  src?: string | null;
  sck?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

export interface PedidoParaUtmify {
  orderId: string;
  /** Quem cobrou este pedido. Vira o `platform` do relatório dela. */
  plataforma?: string;
  status: StatusUtmify;
  metodo: MetodoUtmify;
  criadoEm: Date;
  aprovadoEm?: Date | null;
  cliente: {
    nome: string;
    email: string;
    telefone?: string | null;
    documento?: string | null;
    ip?: string | null;
  };
  produto: { id: string; nome: string; precoCentavos: number };
  /** Quanto o gateway cobrou de taxa. `0` quando ainda não se sabe. */
  taxaCentavos?: number;
  rastreio?: ParametrosDeRastreio;
}

/** `YYYY-MM-DD HH:MM:SS` em UTC — o formato que a Utmify exige. */
function emUtc(data: Date): string {
  return data.toISOString().slice(0, 19).replace('T', ' ');
}

function credencial(): string | null {
  return process.env.UTMIFY_API_TOKEN?.trim() || null;
}

/**
 * Avisa a Utmify sobre um pedido.
 *
 * Devolve `true` só quando ela confirmou. Sem token configurado devolve
 * `false` em silêncio — não é erro, é integração desligada.
 */
export async function reportarPedido(pedido: PedidoParaUtmify): Promise<boolean> {
  const token = credencial();
  if (!token) {
    /**
     * Silêncio aqui custou caro em 24/08.
     *
     * Sem token, o envio devolvia `false` e não dizia nada — e quem estava
     * olhando o painel da Utmify vazio não tinha como saber se o problema era
     * configuração, rede ou venda que não aconteceu. Aviso barato, uma linha
     * por venda, só enquanto estiver desconfigurado.
     */
    console.warn(
      `[utmify] pedido ${pedido.orderId} NÃO reportado: UTMIFY_API_TOKEN vazio.`
    );
    return false;
  }

  const corpo = {
    orderId: pedido.orderId,
    /**
     * Quem cobrou de verdade, vindo do pedido — não uma constante.
     *
     * Era `process.env.UTMIFY_PLATAFORMA ?? 'Cakto'`, de quando a Cakto era o
     * plano. Com o Mercado Pago cobrando, TODA venda aparecia no painel da
     * Utmify como se fosse da Cakto, que nunca cobrou um centavo. Um painel
     * que existe para conferir não pode mentir sobre a origem do dinheiro.
     */
    platform: pedido.plataforma ?? process.env.UTMIFY_PLATAFORMA ?? 'MercadoPago',
    paymentMethod: pedido.metodo,
    status: pedido.status,
    createdAt: emUtc(pedido.criadoEm),
    approvedDate: pedido.aprovadoEm ? emUtc(pedido.aprovadoEm) : null,
    refundedAt: null,
    customer: {
      name: pedido.cliente.nome,
      email: pedido.cliente.email,
      phone: pedido.cliente.telefone ?? null,
      document: pedido.cliente.documento ?? null,
      country: 'BR',
      ip: pedido.cliente.ip ?? '',
    },
    products: [
      {
        id: pedido.produto.id,
        name: pedido.produto.nome,
        planId: null,
        planName: null,
        quantity: 1,
        priceInCents: pedido.produto.precoCentavos,
      },
    ],
    trackingParameters: {
      src: pedido.rastreio?.src ?? null,
      sck: pedido.rastreio?.sck ?? null,
      utm_source: pedido.rastreio?.utm_source ?? null,
      utm_campaign: pedido.rastreio?.utm_campaign ?? null,
      utm_medium: pedido.rastreio?.utm_medium ?? null,
      utm_content: pedido.rastreio?.utm_content ?? null,
      utm_term: pedido.rastreio?.utm_term ?? null,
    },
    commission: {
      totalPriceInCents: pedido.produto.precoCentavos,
      gatewayFeeInCents: pedido.taxaCentavos ?? 0,
      /**
       * O que sobra para quem vende, depois da taxa. A Utmify usa este número
       * como receita no relatório — mandar o valor cheio infla o resultado de
       * toda campanha e faz o CPA parecer melhor do que é.
       */
      userCommissionInCents: Math.max(
        0,
        pedido.produto.precoCentavos - (pedido.taxaCentavos ?? 0)
      ),
      currency: 'BRL' as const,
    },
    isTest: process.env.UTMIFY_TESTE === '1',
  };

  try {
    const resposta = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': token },
      body: JSON.stringify(corpo),
      // Este envio acontece dentro do webhook do gateway, que precisa
      // responder rápido. Se a Utmify demorar, desiste — perder uma linha de
      // relatório é melhor que fazer o gateway retentar a notificação.
      signal: AbortSignal.timeout(6000),
    });

    if (!resposta.ok) {
      console.error(
        `[utmify] ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`
      );
      return false;
    }
    /**
     * O sucesso também é logado, e isso não é ruído.
     *
     * Antes só a falha aparecia, então "nada no log" queria dizer duas coisas
     * opostas — deu certo, ou nem chegou a tentar. Foi exatamente essa
     * ambiguidade que fez a venda de 24/08 passar despercebida.
     */
    console.log(
      `[utmify] ${pedido.status} reportado: pedido ${pedido.orderId}, ` +
        `R$ ${(pedido.produto.precoCentavos / 100).toFixed(2)}`
    );
    return true;
  } catch (erro) {
    console.error(`[utmify] falhou no pedido ${pedido.orderId}:`, erro);
    return false;
  }
}

/**
 * Traduz o método do gateway para o vocabulário da Utmify.
 *
 * ── Por que não é um `switch` com dois casos ──────────────────────────────
 *
 * A versão anterior mapeava `credit_card` e caía em `pix` no resto. Isso
 * funcionava com um gateway só; com dois, não. O Payment Brick do Mercado
 * Pago manda a **bandeira** no lugar do método — `master`, `visa`, `elo` — e
 * a Cakto manda `credit_card` ou `threeDs`. Com a regra antiga, toda venda no
 * cartão pelo MP chegaria à Utmify marcada como Pix, e o relatório diria que
 * ninguém compra de cartão.
 *
 * `meioDe` já sabe traduzir os dois vocabulários, porque é ele que decide
 * qual gateway cobra cada meio. Reusar aqui é o que impede as duas tabelas de
 * divergirem com o tempo.
 */
export function metodoParaUtmify(metodo: string | null | undefined): MetodoUtmify {
  switch (meioDe(metodo ?? undefined)) {
    case 'cartao':
      return 'credit_card';
    case 'boleto':
      return 'boleto';
    default:
      return 'pix';
  }
}
