import { randomUUID } from 'crypto';
import type {
  Cobravel,
  DadosCriacao,
  PagamentoResumido,
  ProvedorPagamento,
  ResultadoPagamento,
} from './mercadopago';
import { precoComDesconto } from '../../lib/cupons';
import { ofertaGravada, gravarOferta } from './cakto-ofertas';

/**
 * Cakto — o gateway que substitui o Mercado Pago.
 *
 * ── A diferença estrutural ────────────────────────────────────────────────
 *
 * O Mercado Pago cobrava **um valor que a gente mandava**. A Cakto cobra
 * **uma oferta cadastrada na conta dela**: `items[0].offerId` decide o preço,
 * e não existe campo de valor no corpo — conferido no OpenAPI, não deduzido.
 *
 * `cakto-ofertas.ts` existe para desfazer isso: dado um preço, ele devolve um
 * `offerId`, criando a oferta na primeira vez. O preço continua sendo nosso.
 *
 * ── O que este módulo deliberadamente NÃO muda ────────────────────────────
 *
 * O vocabulário. `webhook-pagamento.ts`, o painel, a reconciliação e a
 * sentinela financeira falam `approved`/`pending`/`rejected` desde o Asaas.
 * Traduzir aqui (`paid` → `approved`) mantém tudo isso intacto: o resto do
 * sistema continua sem saber quem está cobrando. A alternativa — espalhar
 * `status === 'paid' || status === 'approved'` por sete arquivos — é como
 * essas migrações costumam apodrecer.
 *
 * ── Sem sandbox ───────────────────────────────────────────────────────────
 *
 * A Cakto não tem ambiente de teste. Procurei "sandbox", "homologação" e
 * "ambiente de teste" nos 266 KB do OpenAPI e em todas as páginas do SDK:
 * zero ocorrências. Todo teste de ponta a ponta é cobrança real — daí a
 * oferta de R$ 1,00 do plano de virada.
 */

const BASE = 'https://api.cakto.com.br/public_api';

/** Uma compra travada em 40s é uma compra perdida. Mesmo número do MP. */
const TIMEOUT_MS = 8000;

/* ── autenticação ─────────────────────────────────────────────────────────
 *
 * OAuth2 client_credentials, e **não existe endpoint de renovação**: quando o
 * token expira, pede outro. O cache é obrigatório, não otimização — são 120
 * req/min por token, e pedir um token novo a cada cobrança gastaria boa parte
 * do orçamento só com autenticação.
 */

let tokenEmCache: { valor: string; expiraEm: number } | null = null;

/**
 * Renova 60s antes do vencimento real.
 *
 * Sem a margem, um token que expira "agora" passa na checagem, sai na
 * requisição e volta 401 — e esse 401 chega como falha de cobrança para
 * alguém que está com o cartão na mão. A margem transforma isso numa
 * renovação silenciosa.
 */
const MARGEM_DE_RENOVACAO_MS = 60_000;

/** Os testes derrubam o cache entre casos. */
export function esquecerToken(): void {
  tokenEmCache = null;
}

export async function obterToken(agora = Date.now()): Promise<string> {
  if (tokenEmCache && tokenEmCache.expiraEm > agora) return tokenEmCache.valor;

  const clientId = process.env.CAKTO_CLIENT_ID;
  const clientSecret = process.env.CAKTO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('[cakto] CAKTO_CLIENT_ID/CAKTO_CLIENT_SECRET ausentes');
  }

  const resposta = await fetch(`${BASE}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!resposta.ok) {
    throw new Error(`[cakto] token recusado (${resposta.status}): ${await resposta.text()}`);
  }

  const corpo = (await resposta.json()) as { access_token?: string; expires_in?: number };
  if (!corpo.access_token) throw new Error('[cakto] resposta de token sem access_token');

  // `expires_in` em segundos (36000 = 10h). Sem ele, assume 5 min — curto de
  // propósito: renovar à toa é barato, carregar um token morto não é.
  const duracaoMs = (corpo.expires_in ?? 300) * 1000;
  tokenEmCache = {
    valor: corpo.access_token,
    expiraEm: agora + Math.max(duracaoMs - MARGEM_DE_RENOVACAO_MS, 0),
  };

  return tokenEmCache.valor;
}

async function chamar(
  caminho: string,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<Response> {
  const { idempotencyKey, ...resto } = init;
  const token = await obterToken();

  return fetch(`${BASE}${caminho}`, {
    ...resto,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...(resto.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/* ── ofertas ──────────────────────────────────────────────────────────────*/

/**
 * O `offerId` para um preço, criando a oferta se ela ainda não existir.
 *
 * O nome carrega o valor (`Revelação — R$ 12,80`) porque é o que vai aparecer
 * no checkout e no painel da Cakto. Sem o valor no nome, três ofertas do mesmo
 * produto viram três linhas idênticas e ninguém sabe qual é qual.
 */
export async function garantirOferta(produto: Cobravel, precoCentavos: number): Promise<string> {
  const gravada = ofertaGravada(produto.id, precoCentavos);
  if (gravada) return gravada;

  const produtoCakto = process.env.CAKTO_PRODUTO_ID;
  if (!produtoCakto) throw new Error('[cakto] CAKTO_PRODUTO_ID ausente');

  const nome = `${produto.descricao} — ${formatarReais(precoCentavos)}`;

  const resposta = await chamar('/offers/', {
    method: 'POST',
    body: JSON.stringify({
      name: nome.slice(0, 255),
      // A Cakto fala em reais; a gente pensa em centavos. A conversão mora
      // aqui e em `emCentavos`, e em nenhum outro lugar.
      price: precoCentavos / 100,
      product: produtoCakto,
      status: 'active',
      type: 'unique',
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `[cakto] falha ao criar oferta de ${precoCentavos} centavos (${resposta.status}): ` +
        (await resposta.text())
    );
  }

  const criada = (await resposta.json()) as { id?: string };
  if (!criada.id) throw new Error('[cakto] oferta criada sem id na resposta');

  gravarOferta({ produto: produto.id, precoCentavos, offerId: criada.id, nome });
  console.warn(`[cakto] oferta criada: ${nome} → ${criada.id}`);

  return criada.id;
}

function formatarReais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Compara o que a Cakto cobrou com o que a gente esperava cobrar.
 *
 * Não lança: a cobrança **já aconteceu** quando isto roda, e derrubar a
 * resposta agora deixaria alguém pago com o `pagamento_id` não gravado — o
 * pior dos dois mundos. Grita no log, e a sentinela financeira
 * (`checarValorCobrado`) pega de novo na confirmação, já com o pedido em mãos.
 */
export function conferirPreco(esperadoCentavos: number, cobradoCentavos: number | null): void {
  if (cobradoCentavos === null || cobradoCentavos === esperadoCentavos) return;
  console.error(
    `[cakto] ⚠️  PREÇO DIVERGENTE: esperava ${esperadoCentavos} centavos, ` +
      `a oferta cobrou ${cobradoCentavos}. Confira a oferta no painel da Cakto.`
  );
}

/* ── o que o front manda ──────────────────────────────────────────────────
 *
 * O Payment Brick entregava um `formData` pronto. A Cakto não tem Brick: o
 * SDK dela só tokeniza cartão, roda 3DS e coleta antifraude — o formulário é
 * nosso, e por isso estes campos chegam um a um.
 *
 * Os quatro obrigatórios de `customer` (`name`, `email`, `phone`,
 * `fingerprint`) são o motivo de a tela de pagamento passar a ter campos que
 * o Brick não pedia. Não é capricho: sem eles a cobrança não nasce.
 */
export interface DadosCaktoDoFront {
  metodo: 'pix' | 'credit_card' | 'threeDs' | 'boleto';
  nome: string;
  /** E.164 sem o `+`: `5511999999999`. */
  telefone: string;
  docNumber?: string;
  docType?: 'cpf' | 'cnpj';
  /** Identificador estável do dispositivo/sessão, do SDK deles. Obrigatório. */
  fingerprint: string;
  /** `caktoSdk.getAntifraudReference()`. Obrigatório no cartão. */
  antifraudReference?: string;
  /** `caktoSdk.createToken()`. Uso único, vale 15 minutos. */
  cardToken?: string;
  threeDSecure?: {
    cavv?: string;
    eci?: string;
    xid?: string;
    referenceId?: string;
    version?: string;
  };
  /** Capturados no navegador. Viram atribuição dentro do painel deles também. */
  utm?: Record<string, string | undefined>;
  /**
   * Código do cupom, **cadastrado no painel da Cakto**.
   *
   * A API deles não tem endpoint de cupom — conferido no OpenAPI: existem
   * produtos, ofertas, pedidos, webhooks e assinaturas, e cupom não. Então o
   * cupom de 20% nasce no painel uma vez, e aqui a gente só repassa o código.
   *
   * Quem calcula o desconto passa a ser a Cakto. O nosso `precoComDesconto`
   * continua valendo para a VITRINE e para conferir o que foi cobrado — se os
   * dois discordarem, `conferirPreco` grita.
   */
  cupomCodigo?: string;
}

export type DadosCriacaoCakto = DadosCriacao & { cakto: DadosCaktoDoFront };

/** Os cinco que a Cakto aceita. Qualquer outro é descartado em silêncio. */
const UTMS_ACEITAS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * Monta o corpo de `POST /public_api/payments/`.
 *
 * Exportada para o teste: é aqui que moram a decisão de preço (via `offerId`)
 * e a de identidade do pedido (via `sck`), e as duas erram em silêncio.
 */
export function montarCorpo(dados: DadosCriacaoCakto, offerId: string) {
  const { cakto, pedidoId } = dados;

  const utm: Record<string, string> = {};
  for (const chave of UTMS_ACEITAS) {
    const valor = cakto.utm?.[chave];
    if (valor) utm[chave] = String(valor).slice(0, 255);
  }

  const corpo: Record<string, unknown> = {
    paymentMethod: cakto.metodo,
    customer: {
      name: cakto.nome,
      // A Cakto EXIGE e-mail. Pedidos do funil de anúncio podem nascer sem
      // (quem não aceitou os termos), e aí vale um endereço do nosso próprio
      // domínio, único por pedido — nunca um `example.com`, que qualquer
      // motor de risco marca como suspeito.
      email: dados.emailDoPedido || `pedido+${pedidoId}@bruxario.com.br`,
      phone: cakto.telefone.replace(/\D/g, ''),
      fingerprint: cakto.fingerprint,
      ...(cakto.docNumber
        ? { docType: cakto.docType ?? 'cpf', docNumber: cakto.docNumber.replace(/\D/g, '') }
        : {}),
    },
    items: [{ offerId, quantity: 1, offerType: 'main' }],
    /**
     * **`sck` é o nosso `external_reference`.**
     *
     * A Cakto não tem campo livre em `metadata` — são seis campos fixos, cinco
     * de UTM e o `sck`. Sem isto, o único vínculo entre cobrança e pedido seria
     * o `id` que volta na resposta, e uma notificação que chegasse antes de a
     * gente gravar esse id deixaria o pagamento órfão.
     *
     * O corpo do webhook não traz `sck`. O `GET /orders/{id}/` traz — e a nossa
     * regra já é sempre consultar em vez de confiar no corpo, então ele chega
     * exatamente onde precisamos dele.
     */
    metadata: { ...utm, sck: pedidoId },
    ...(cakto.cupomCodigo ? { coupon: cakto.cupomCodigo } : {}),
  };

  if (cakto.metodo === 'pix') corpo.pixExpiresIn = 3600;

  if (cakto.metodo === 'credit_card' || cakto.metodo === 'threeDs') {
    corpo.card = { token: cakto.cardToken };
    corpo.antifraudProfilingAttemptReference = cakto.antifraudReference;
    if (cakto.metodo === 'threeDs') corpo.threeDSecure = cakto.threeDSecure;
  }

  return corpo;
}

/* ── tradução ─────────────────────────────────────────────────────────────*/

/**
 * Cakto → nosso vocabulário.
 *
 * `paid` é o único que vira `approved`, e `statusLiberaAcesso` continua sendo
 * a única função do projeto que decide se alguém recebe o que comprou.
 */
export function traduzirStatus(status: string | undefined): string {
  switch (status) {
    case 'paid':
      return 'approved';
    case 'waiting_payment':
      return 'pending';
    case 'declined':
    case 'refused':
      return 'rejected';
    case 'refunded':
      return 'refunded';
    case 'chargeback':
      return 'charged_back';
    default:
      return status ?? 'unknown';
  }
}

/** A Cakto manda dinheiro como string decimal em reais (`"9.80"`). */
export function emCentavos(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

export interface RespostaCakto {
  id?: string;
  refId?: string;
  status?: string;
  paymentMethod?: string;
  amount?: string | number;
  baseAmount?: string | number | null;
  discount?: string | number | null;
  fees?: string | number | null;
  sck?: string | null;
  paidAt?: string | null;
  pix?: { qrCode?: string; qrCodeBase64?: string; expirationDate?: string };
}

export function traduzir(r: RespostaCakto): ResultadoPagamento {
  const bruto = emCentavos(r.amount);
  const taxa = emCentavos(r.fees);

  return {
    idExterno: String(r.id ?? ''),
    status: traduzirStatus(r.status),
    // A Cakto não manda motivo de recusa separado; o status já é o motivo.
    statusDetalhe: r.status ?? '',
    referenciaExterna: r.sck ?? null,
    brutoCentavos: bruto,
    taxaCentavos: taxa,
    /**
     * O líquido é subtração, não um campo.
     *
     * O MP mandava `net_received_amount` pronto. Aqui existem só `amount` e
     * `fees`, e `fees` **não vem na resposta da criação do cartão** — só no
     * `GET /orders/{id}/`. `null` quando falta qualquer um dos dois: líquido
     * chutado vira lucro imaginário no painel, que é pior que campo vazio.
     */
    liquidoCentavos: bruto !== null && taxa !== null ? bruto - taxa : null,
    metodo: r.paymentMethod ?? null,
    ...(r.pix?.qrCode
      ? { pix: { copiaECola: r.pix.qrCode, qrBase64: r.pix.qrCodeBase64 ?? '' } }
      : {}),
  };
}

/* ── o provedor ───────────────────────────────────────────────────────────*/

export class ProvedorCakto implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const cakto = (dados as Partial<DadosCriacaoCakto>).cakto;
    if (!cakto) throw new Error('[cakto] dados do front ausentes (o SDK não rodou?)');

    /**
     * **A oferta é sempre a do preço CHEIO.**
     *
     * O desconto não entra aqui: ele é um cupom cadastrado na Cakto, e é ela
     * que aplica. Criar uma oferta por preço com desconto daria duas fontes de
     * verdade para o mesmo abatimento — o nosso percentual e o cupom deles — e
     * a hora em que as duas divergissem seria a hora em que alguém pagaria o
     * valor errado.
     *
     * `precoComDesconto` continua sendo o que a vitrine mostra e o que
     * `conferirPreco` espera ver cobrado.
     */
    const preco = precoComDesconto(
      dados.produto,
      dados.descontoPercentual,
      dados.bumpsCentavos
    );
    const offerId = await garantirOferta(dados.produto, dados.produto.precoCentavos);

    /**
     * Chave derivada do pedido **e da tentativa**.
     *
     * Só o `pedidoId` faria a segunda tentativa (cartão recusado, a pessoa
     * tenta outro) devolver a resposta guardada da primeira — a recusa
     * anterior, de novo, pelas 24h de retenção. Reusar a chave com corpo
     * diferente, aliás, dá 409.
     */
    const resposta = await chamar('/payments/', {
      method: 'POST',
      body: JSON.stringify(montarCorpo({ ...dados, cakto }, offerId)),
      idempotencyKey: `${dados.pedidoId}-${randomUUID()}`,
    });

    if (!resposta.ok) {
      throw new Error(`[cakto] cobrança recusada (${resposta.status}): ${await resposta.text()}`);
    }

    const resultado = traduzir((await resposta.json()) as RespostaCakto);
    conferirPreco(preco.finalCentavos, resultado.brutoCentavos);

    return resultado;
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      const resposta = await chamar(`/orders/${idExterno}/`);
      if (!resposta.ok) {
        console.error(`[cakto] consulta a ${idExterno} falhou (${resposta.status})`);
        return null;
      }
      return traduzir((await resposta.json()) as RespostaCakto);
    } catch (erro) {
      console.error(`[cakto] falha ao consultar ${idExterno}:`, erro);
      return null;
    }
  }

  /**
   * Estorno integral — a Cakto não faz parcial.
   *
   * Devolve `{ ok: false, erro }` em vez de lançar, como o do MP: quem chama é
   * uma tela de painel, e o dono precisa ler o motivo ("Pedido já
   * reembolsado", "Não é possível reembolsar uma ordem que não está paga") e
   * decidir — não levar um 500 genérico.
   */
  async estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await chamar(`/orders/${idExterno}/refund/`, { method: 'POST' });
      const corpo = (await resposta.json().catch(() => ({}))) as { detail?: string };
      if (!resposta.ok) return { ok: false, erro: corpo.detail ?? `HTTP ${resposta.status}` };
      return { ok: true };
    } catch (erro) {
      console.error(`[cakto] falha ao estornar ${idExterno}:`, erro);
      return { ok: false, erro: String(erro) };
    }
  }

  /**
   * Reconciliação — e aqui a Cakto é pior que o Mercado Pago.
   *
   * `GET /public_api/orders/` aceita **só `limit` e `page`**: não existe
   * filtro por data. Então isto deixa de ser busca e vira paginação, da página
   * mais recente até passar da janela pedida.
   *
   * `[]` em caso de erro, mesma regra do MP: reconciliação que não roda hoje
   * tenta de novo amanhã, e não é motivo para lançar.
   */
  async listarPagosNoPeriodo(desde: Date, ate: Date): Promise<PagamentoResumido[]> {
    const resumidos: PagamentoResumido[] = [];
    const LIMITE = 100;
    /** Trava: sem filtro de data, um bug aqui pagina para sempre. */
    const MAX_PAGINAS = 50;

    try {
      for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
        const resposta = await chamar(`/orders/?limit=${LIMITE}&page=${pagina}`);
        if (!resposta.ok) break;

        const corpo = (await resposta.json()) as {
          results?: RespostaCakto[];
          next?: string | null;
        };
        const resultados = corpo.results ?? [];
        if (resultados.length === 0) break;

        let passouDaJanela = false;

        for (const r of resultados) {
          if (!r.paidAt) continue;
          const pagoEm = new Date(r.paidAt);

          // A lista vem do mais recente para o mais antigo: passou do começo
          // da janela, não há mais nada de interesse adiante.
          if (pagoEm < desde) {
            passouDaJanela = true;
            continue;
          }
          if (pagoEm > ate) continue;

          resumidos.push({
            idExterno: String(r.id ?? ''),
            status: traduzirStatus(r.status),
            referenciaExterna: r.sck ?? null,
          });
        }

        if (passouDaJanela || !corpo.next) break;
      }
    } catch (erro) {
      console.error('[cakto] falha ao listar período para reconciliação:', erro);
      return [];
    }

    return resumidos;
  }
}

/** Segredo do webhook da Cakto. Viaja no CORPO, não em header. */
export function segredoDoWebhook(): string | undefined {
  return process.env.CAKTO_WEBHOOK_SECRET || undefined;
}

/** Há credencial configurada? Sem isto o roteador nem oferece a Cakto. */
export function caktoConfigurada(): boolean {
  return Boolean(process.env.CAKTO_CLIENT_ID && process.env.CAKTO_CLIENT_SECRET);
}
