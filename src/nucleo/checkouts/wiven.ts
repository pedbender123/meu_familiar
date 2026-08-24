import { randomUUID } from 'node:crypto';
import type {
  DadosCriacao,
  PagamentoResumido,
  ProvedorPagamento,
  ResultadoPagamento,
} from './mercadopago';
import { precoComDesconto } from '../../lib/cupons';

/**
 * Wiven — Pix e cartão, cobrança avulsa.
 *
 * ── O que muda em relação à Cakto ─────────────────────────────────────────
 *
 * Duas coisas, e as duas para melhor:
 *
 *   1. **`identifier` é nosso.** String única que a NOSSA aplicação cria e
 *      manda no corpo. Some a gambiarra do `sck`, que era o único campo livre
 *      da Cakto que voltava na consulta.
 *   2. **Valor livre.** O corpo aceita `amount` direto — nada de produto ou
 *      oferta cadastrada. `cakto-ofertas.ts` não tem equivalente aqui.
 *
 * ── E o que muda para pior ────────────────────────────────────────────────
 *
 * O endpoint de cartão recebe **PAN e CVV em texto puro** (`card.number`,
 * `card.cvv`). Hoje, com o Brick do Mercado Pago, o número do cartão nunca
 * toca esta máquina: o navegador tokeniza e manda um `token`. Aqui, não.
 *
 * A decisão do dono (23/08) foi seguir mesmo assim, com passagem direta:
 * os campos atravessam a rota e vão para a Wiven na MESMA requisição —
 * **nunca gravados, nunca em cache, nunca em log, nem no caminho do erro.**
 * É por isso que `montarCorpoCartao` monta o objeto e o devolve sem que ele
 * passe por nenhuma variável de módulo, e que as mensagens de erro daqui
 * nunca ecoam o corpo enviado, só o do gateway.
 *
 * Isso reduz o risco real; **não tira o escopo PCI-DSS**, porque a régua é
 * transmitir ou processar, não armazenar. Está registrado para ser escolha,
 * não surpresa.
 *
 * ── Nasce desligado ───────────────────────────────────────────────────────
 *
 * `gateway.ts` ainda não conhece o nome `wiven`. Enquanto o webhook não
 * estiver escrito e testado, nada roteia para cá — e sem webhook nada
 * libera acesso, que é a regra que não se discute.
 */

const BASE = 'https://app.wiven.com.br/api/v1';

/* ── configuração ─────────────────────────────────────────────────────────*/

export function wivenConfigurada(): boolean {
  return !!process.env.WIVEN_PUBLIC_KEY?.trim() && !!process.env.WIVEN_SECRET_KEY?.trim();
}

function chaves(): { publica: string; secreta: string } {
  const publica = process.env.WIVEN_PUBLIC_KEY?.trim();
  const secreta = process.env.WIVEN_SECRET_KEY?.trim();
  if (!publica || !secreta) {
    throw new Error('[wiven] falta WIVEN_PUBLIC_KEY / WIVEN_SECRET_KEY');
  }
  return { publica, secreta };
}

/** Para onde a Wiven avisa que o status mudou. Vai por transação, no corpo. */
export function urlDeCallback(): string {
  const base = process.env.BASE_URL || 'https://bruxario.com.br';
  return `${base.replace(/\/$/, '')}/api/webhook/wiven`;
}

async function chamar(caminho: string, init: RequestInit = {}): Promise<Response> {
  const { publica, secreta } = chaves();
  return fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-public-key': publica,
      'x-secret-key': secreta,
      ...(init.headers ?? {}),
    },
    // Compra travada em 40s é compra perdida — o mesmo limite do Mercado Pago.
    signal: AbortSignal.timeout(8000),
  });
}

/* ── dinheiro ─────────────────────────────────────────────────────────────*/

/**
 * A Wiven fala em **reais, número decimal** (`100.5`). O projeto inteiro fala
 * centavos inteiros.
 *
 * O `toFixed(2)` antes do `Number` não é firula: sem ele, um valor vindo de
 * conta com float chegaria como `18.900000000000002` no JSON, e a Wiven
 * recusaria ou cobraria um centavo a mais. Centavo a mais em cobrança é a
 * mesma classe de bug que fez a Completa nascer em 2363.
 */
export function emReais(centavos: number): number {
  return Number((centavos / 100).toFixed(2));
}

/** E a volta: `fee` e `amount` chegam em reais decimais. */
export function emCentavos(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/* ── identificador ────────────────────────────────────────────────────────*/

const SEPARADOR = '--';

/**
 * O `identifier` que vai no corpo.
 *
 * **Não pode ser o `pedidoId` puro.** A Wiven exige um identificador único
 * *por transação*, e uma compra costuma ter mais de uma: cartão recusado e a
 * pessoa tenta outro é o caso normal, não a exceção. Reusar o identificador
 * na segunda tentativa daria conflito, e o sintoma seria uma venda perdida
 * exatamente em quem estava mais decidido a comprar.
 *
 * Então: `pedidoId--<uuid>`. O prefixo é o que o webhook usa para reencontrar
 * o pedido; o sufixo é o que faz cada tentativa ser uma transação nova.
 */
export function identificadorDe(pedidoId: string): string {
  return `${pedidoId}${SEPARADOR}${randomUUID()}`;
}

/**
 * A volta: do `identifier` para o nosso `pedidoId`.
 *
 * Tolerante de propósito — um identificador sem sufixo (feito à mão no painel,
 * ou de uma versão anterior) ainda devolve o pedido em vez de `null`.
 */
export function pedidoDoIdentificador(identifier: string | null | undefined): string | null {
  if (!identifier) return null;
  const corte = identifier.indexOf(SEPARADOR);
  const id = corte === -1 ? identifier : identifier.slice(0, corte);
  return id || null;
}

/* ── tradução ─────────────────────────────────────────────────────────────*/

/** O vocabulário da RESPOSTA DE CRIAÇÃO. */
export type StatusDeCriacao = 'OK' | 'PENDING' | 'FAILED' | 'REJECTED' | 'CANCELED';

/** O vocabulário do WEBHOOK. Não é o mesmo — ver abaixo. */
export type StatusDeWebhook = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'CHARGED_BACK';

/**
 * Wiven → nosso vocabulário.
 *
 * ── A Wiven fala DOIS idiomas ─────────────────────────────────────────────
 *
 * A resposta de criação devolve `OK · PENDING · FAILED · REJECTED · CANCELED`.
 * O webhook devolve `COMPLETED · PENDING · FAILED · REFUNDED · CHARGED_BACK`.
 * Só `PENDING` e `FAILED` são comuns aos dois.
 *
 * Isto é uma mina. Uma tradução que só conhecesse o vocabulário da criação
 * jamais reconheceria `COMPLETED` — e `COMPLETED` é justamente o que chega
 * quando o dinheiro entra. O sintoma seria o pior possível: todo mundo
 * pagando e ninguém recebendo, com o log dizendo apenas
 * `pagamento_COMPLETED` e seguindo em frente.
 *
 * Por isso os dois idiomas moram na mesma função, e há teste para cada
 * palavra dos dois.
 *
 * `statusLiberaAcesso` continua sendo a única função do projeto que decide se
 * alguém recebe o que comprou, e `webhook-pagamento.ts` não ganha uma linha
 * sobre Wiven.
 */
export function traduzirStatus(status: string | undefined): string {
  switch (status) {
    // criação: autorizado. webhook: pago.
    case 'OK':
    case 'COMPLETED':
      return 'approved';
    case 'PENDING':
      return 'pending';
    case 'FAILED':
    case 'REJECTED':
      return 'rejected';
    case 'CANCELED':
      return 'cancelled';
    case 'REFUNDED':
      return 'refunded';
    case 'CHARGED_BACK':
      return 'charged_back';
    default:
      return status ?? 'unknown';
  }
}

export interface RespostaWiven {
  transactionId?: string;
  status?: string;
  fee?: number;
  order?: { id?: string; url?: string; receiptUrl?: string };
  pix?: { code?: string; image?: string; base64?: string };
  details?: string;
  errorDescription?: string;
  identifier?: string;
  amount?: number;
  metadata?: { orderId?: string } & Record<string, unknown>;
}

export function traduzir(
  r: RespostaWiven,
  contexto: { identifier: string; meio: 'pix' | 'cartao'; brutoCentavos: number }
): ResultadoPagamento {
  /**
   * **Pix recém-criado nunca vale `approved`.**
   *
   * A resposta de criação do Pix traz `status: "OK"` no exemplo da
   * documentação — e ali o QR Code acabou de ser gerado, ninguém pagou nada.
   * `OK` na criação significa "a cobrança foi criada", não "o dinheiro
   * entrou"; para o cartão, que é síncrono, significa autorizado.
   *
   * Traduzir `OK` de Pix como `approved` gravaria uma venda que não existe no
   * momento em que a pessoa ainda está abrindo o aplicativo do banco. O
   * acesso não vazaria (só o webhook libera), mas o painel financeiro
   * passaria a contar dinheiro que não entrou — que é exatamente o bug de
   * 22/08 que já custou uma noite.
   *
   * Então: Pix criado é `pending`, sempre. Quem promove a `approved` é o
   * webhook. **Confirmar na documentação de callback** que é essa a leitura.
   */
  const status =
    contexto.meio === 'pix' && r.status === 'OK' ? 'pending' : traduzirStatus(r.status);

  const taxaCentavos = emCentavos(r.fee);

  return {
    idExterno: r.transactionId ?? '',
    status,
    statusDetalhe: r.details ?? r.errorDescription ?? '',
    referenciaExterna: pedidoDoIdentificador(r.identifier ?? contexto.identifier),
    brutoCentavos: emCentavos(r.amount) ?? contexto.brutoCentavos,
    taxaCentavos,
    liquidoCentavos:
      taxaCentavos === null ? null : (emCentavos(r.amount) ?? contexto.brutoCentavos) - taxaCentavos,
    metodo: contexto.meio === 'pix' ? 'pix' : 'credit_card',
    pix: r.pix?.code
      ? {
          copiaECola: r.pix.code,
          /**
           * A Wiven **deprecou o base64** — o campo existe e volta sempre
           * vazio. Quem desenha o QR é a URL de `image`, e o `?? ''` mantém o
           * contrato do tipo compartilhado sem inventar um base64 que não
           * existe.
           */
          qrBase64: '',
          qrUrl: r.pix.image,
        }
      : undefined,
  };
}

/* ── o que o front precisa mandar ─────────────────────────────────────────*/

/** Os campos do cartão. **Nunca gravados, nunca logados.** Só de passagem. */
export interface CartaoWiven {
  number: string;
  owner: string;
  /** `YYYY-MM`. */
  expiresAt: string;
  cvv: string;
}

export interface DadosCriacaoWiven extends DadosCriacao {
  wiven: {
    meio: 'pix' | 'cartao';
    nome: string;
    /** `(11) 99999-9999`, com ou sem formatação. Obrigatório nos dois meios. */
    telefone: string;
    /** CPF. Obrigatório nos dois meios. */
    documento: string;
    /** Só no cartão. */
    ip?: string;
    cartao?: CartaoWiven;
    endereco?: EnderecoWiven;
  };
}

/** Só o cartão exige endereço. O Pix pede apenas nome, e-mail, telefone e CPF. */
export interface EnderecoWiven {
  country: string;
  zipCode: string;
  state: string;
  city: string;
  street: string;
  neighborhood: string;
  number: string;
  complement?: string;
}

/* ── o provedor ───────────────────────────────────────────────────────────*/

export class ProvedorWiven implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const extra = (dados as Partial<DadosCriacaoWiven>).wiven;
    if (!extra) throw new Error('[wiven] dados do front ausentes');

    /**
     * O preço é relido do produto no servidor, com o desconto que já está
     * gravado no pedido. Nunca vem do navegador — `amount` editável pelo
     * cliente seria preço editável pelo cliente.
     */
    const preco = precoComDesconto(dados.produto, dados.descontoPercentual);
    const identifier = identificadorDe(dados.pedidoId);

    const corpo = {
      identifier,
      amount: emReais(preco.finalCentavos),
      client: {
        name: extra.nome,
        email: dados.emailDoPedido,
        phone: extra.telefone,
        document: extra.documento,
        ...(extra.meio === 'cartao' ? { address: extra.endereco } : {}),
      },
      /**
       * `metadata.orderId` leva o `pedidoId` LIMPO, sem o sufixo da tentativa.
       *
       * Redundante com o `identifier` de propósito: se o callback trouxer um
       * dos dois, o pedido é reencontrado. Descobrir qual dos dois ele traz
       * depois de uma venda perdida é caro demais para valer a economia de um
       * campo.
       */
      metadata: { provider: 'Bruxario', orderId: dados.pedidoId },
      callbackUrl: urlDeCallback(),
      ...(extra.meio === 'cartao'
        ? {
            clientIp: extra.ip,
            card: extra.cartao,
            // Parcelar quinze reais faz o produto parecer mais caro do que é.
            installments: 1,
          }
        : {}),
    };

    const resposta = await chamar(
      extra.meio === 'pix' ? '/gateway/pix/receive' : '/gateway/card/receive',
      { method: 'POST', body: JSON.stringify(corpo) }
    );

    if (!resposta.ok) {
      /**
       * O texto do gateway, nunca o corpo que a gente mandou.
       *
       * Ecoar o corpo aqui colocaria PAN e CVV no log de erro — o lugar onde
       * dado de cartão mais costuma vazar, porque ninguém trata log de erro
       * como dado sensível.
       */
      throw new Error(`[wiven] cobrança recusada (${resposta.status}): ${await resposta.text()}`);
    }

    return traduzir((await resposta.json()) as RespostaWiven, {
      identifier,
      meio: extra.meio,
      brutoCentavos: preco.finalCentavos,
    });
  }

  /**
   * `GET /gateway/transactions`, por `id` ou por `clientIdentifier`.
   *
   * `clientIdentifier` é o nosso `identifier` de volta — a documentação diz
   * "corresponde ao valor enviado por você na criação". É o que torna a
   * consulta útil quando o webhook chegou sem `identifier`.
   *
   * ── Cuidado com o dinheiro aqui ───────────────────────────────────────
   *
   * Este endpoint tem o TERCEIRO vocabulário de dinheiro da Wiven:
   * `chargeAmount` é "valor pago pelo cliente" e `amount` é "o valor que você
   * vai receber". Nenhum dos dois é a taxa, e não há campo de taxa nenhum.
   *
   * Então a taxa fica `null` de propósito. Inventá-la a partir da diferença
   * entre os dois seria chutar: a diferença existe por juros de parcelamento
   * do checkout interno, não pela nossa taxa. Quem sabe a taxa é o webhook,
   * pelo `commissionAmount`, e é de lá que o painel financeiro se alimenta.
   */
  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      const resposta = await chamar(`/gateway/transactions?id=${encodeURIComponent(idExterno)}`);
      if (!resposta.ok) {
        console.error(`[wiven] consulta a ${idExterno} falhou (${resposta.status})`);
        return null;
      }

      const corpo = (await resposta.json()) as RespostaConsultaWiven | RespostaConsultaWiven[];
      // "Buscar transações", no plural — mas com `id` volta uma só. Aceita as
      // duas formas em vez de apostar em qual delas a rota devolve hoje.
      const t = Array.isArray(corpo) ? corpo[0] : corpo;
      if (!t?.id) return null;

      return traduzirConsulta(t);
    } catch (erro) {
      console.error(`[wiven] consulta a ${idExterno} lançou:`, erro);
      return null;
    }
  }

  /**
   * `POST /gateway/producer/refunds`.
   *
   * **Não é estorno imediato: é solicitação.** A resposta volta `PENDING` e
   * "entra em análise". Diferente do Mercado Pago, onde o estorno é o fato.
   *
   * Quem chama isto (o botão do painel) precisa saber: `ok: true` aqui
   * significa "pedido registrado", não "dinheiro devolvido".
   */
  async estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await chamar('/gateway/producer/refunds', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: idExterno,
          reason: 'Estorno solicitado pelo painel do Bruxário',
        }),
      });

      if (resposta.ok) return { ok: true };

      const texto = await resposta.text();

      /**
       * 422 com reembolso já existente **não é falha**.
       *
       * O botão do painel pode ser clicado duas vezes, e a segunda tentativa
       * devolver erro faria alguém achar que o estorno não aconteceu e ir
       * mexer no gateway à mão. O desfecho desejado já está de pé.
       */
      if (resposta.status === 422 && /reembolso/i.test(texto)) {
        return { ok: true };
      }

      return { ok: false, erro: `[wiven] estorno recusado (${resposta.status}): ${texto}` };
    } catch (erro) {
      return { ok: false, erro: `[wiven] estorno lançou: ${String(erro)}` };
    }
  }

  /**
   * ── Não dá para implementar, e o silêncio seria pior ────────────────────
   *
   * `GET /gateway/transactions` aceita `id` e `clientIdentifier`. **Não
   * aceita intervalo de datas.** A alternativa seria consultar uma a uma as
   * nossas vendas do período — que é exatamente o padrão que a documentação
   * deles desencoraja no item "Polling bloqueado".
   *
   * Devolver `[]` seria a saída fácil e a pior: a reconciliação concluiria em
   * silêncio que a Wiven não tem nenhum pagamento aprovado no período, e
   * marcaria como suspeita toda venda que o webhook gravou direito. Um alarme
   * que grita errado é pior que alarme nenhum — quem apaga o alarme uma vez
   * apaga sempre.
   *
   * Então lança. Reconciliação que não pode rodar precisa dizer isso.
   */
  async listarPagosNoPeriodo(_desde: Date, _ate: Date): Promise<PagamentoResumido[]> {
    throw new Error(
      '[wiven] a API não filtra transações por período — reconciliação indisponível'
    );
  }
}

/* ── a consulta ───────────────────────────────────────────────────────────*/

export interface RespostaConsultaWiven {
  id?: string;
  clientIdentifier?: string | null;
  status?: string;
  paymentMethod?: string;
  /** "Valor que você vai receber". */
  amount?: number;
  /** "Valor pago pelo cliente" — é este que vale como bruto da venda. */
  chargeAmount?: number;
  statusDescription?: string | null;
  errorDescription?: string | null;
  payedAt?: string | null;
  refundedAt?: string | null;
  pixInformation?: { qrCode?: string; image?: string; base64?: string } | null;
}

export function traduzirConsulta(t: RespostaConsultaWiven): ResultadoPagamento {
  return {
    idExterno: t.id ?? '',
    status: traduzirStatus(t.status),
    statusDetalhe: t.statusDescription ?? t.errorDescription ?? '',
    referenciaExterna: pedidoDoIdentificador(t.clientIdentifier),
    brutoCentavos: emCentavos(t.chargeAmount) ?? emCentavos(t.amount),
    // Não existe campo de taxa nesta rota. Ver o comentário em `consultarPagamento`.
    taxaCentavos: null,
    liquidoCentavos: null,
    metodo: t.paymentMethod === 'PIX' ? 'pix' : (t.paymentMethod?.toLowerCase() ?? null),
    pix: t.pixInformation?.qrCode
      ? { copiaECola: t.pixInformation.qrCode, qrBase64: '', qrUrl: t.pixInformation.image }
      : undefined,
  };
}

/* ── o corpo do webhook ───────────────────────────────────────────────────*/

export type EventoWiven =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_PAID'
  | 'TRANSACTION_CANCELED'
  | 'TRANSACTION_REFUNDED'
  | 'TRANSACTION_CHARGED_BACK';

export interface CorpoWebhookWiven {
  event?: string;
  /** O que prova que a notificação é dela. Viaja no CORPO, não em header. */
  token?: string;
  client?: { name?: string; email?: string; cpf?: string };
  transaction?: {
    id?: string;
    /** O nosso `identifier`. **Anulável** — ver `pedidoDoWebhook`. */
    identifier?: string | null;
    status?: string;
    paymentMethod?: string;
    amount?: number;
    /** "Valor líquido a ser recebido" — é o LÍQUIDO, não a taxa. */
    commissionAmount?: number;
    currency?: string;
    payedAt?: string | null;
    pixInformation?: { qrCode?: string; endToEndId?: string | null } | null;
  };
  trackProps?: Record<string, string>;
}

/**
 * O pedido que a notificação diz respeito.
 *
 * **`transaction.identifier` é anulável** — a documentação marca o campo como
 * `nullable`, e o exemplo de payload dela nem sequer o traz. Confiar só nele
 * seria apostar a entrega numa string que a própria Wiven avisa que pode
 * chegar vazia.
 *
 * Por isso o webhook tem dois caminhos: este, e o `transaction.id`, que a
 * gente grava no pedido no instante da criação. Um dos dois acha.
 */
export function pedidoDoWebhook(corpo: CorpoWebhookWiven): string | null {
  return pedidoDoIdentificador(corpo.transaction?.identifier);
}

/**
 * O corpo do webhook vira o mesmo `ResultadoPagamento` que todo o resto do
 * projeto já sabe consumir.
 *
 * ── A contabilidade é ao contrário da criação ─────────────────────────────
 *
 * Na criação, `fee` é **a taxa**. No webhook, `commissionAmount` é
 * **o líquido** ("valor líquido a ser recebido"). Mesmo gateway, dois campos
 * de dinheiro com sentidos opostos.
 *
 * Tratar um como o outro inverteria o painel financeiro: numa venda de
 * R$ 9,80 com R$ 2,58 de taxa, o lucro apareceria como R$ 2,58 em vez de
 * R$ 7,22 — ou pior, R$ 7,22 viraria taxa e o lucro, R$ 2,58. É a mesma
 * família do bug de 22/08, e ela já custou uma noite.
 */
export function traduzirWebhook(corpo: CorpoWebhookWiven): ResultadoPagamento {
  const t = corpo.transaction ?? {};
  const brutoCentavos = emCentavos(t.amount);
  const liquidoCentavos = emCentavos(t.commissionAmount);

  return {
    idExterno: t.id ?? '',
    status: traduzirStatus(t.status),
    statusDetalhe: corpo.event ?? '',
    referenciaExterna: pedidoDoWebhook(corpo),
    brutoCentavos,
    taxaCentavos:
      brutoCentavos === null || liquidoCentavos === null ? null : brutoCentavos - liquidoCentavos,
    liquidoCentavos,
    metodo: t.paymentMethod === 'PIX' ? 'pix' : (t.paymentMethod?.toLowerCase() ?? null),
  };
}

/** O token que prova que a notificação é da Wiven. Cadastrado com o webhook. */
export function tokenDoWebhook(): string {
  return process.env.WIVEN_WEBHOOK_TOKEN?.trim() ?? '';
}
