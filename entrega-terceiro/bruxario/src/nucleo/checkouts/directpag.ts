import { precoComDesconto } from '../../lib/preco';
import type {
  Cobravel,
  DadosCriacao,
  PagamentoResumido,
  ProvedorPagamento,
  ResultadoPagamento,
} from './tipos';

/**
 * DirectPag — o provedor de pagamento desta versão.
 *
 * ── Autenticação ──────────────────────────────────────────────────────────
 *
 * `?api_token=` em **query string**, em toda requisição. Não é header, não é
 * Bearer. Consequência prática: o token aparece em log de proxy e em
 * histórico de requisição — por isso ele nunca é escrito em log aqui, e as
 * mensagens de erro passam por `semSegredo()` antes de subir.
 *
 * ── O que precisa existir ANTES de a primeira venda acontecer ─────────────
 *
 * O DirectPag cobra sempre contra uma **oferta**, nunca contra um valor solto.
 * Então o produto e a oferta precisam existir na conta dele, e o
 * `DIRECTPAG_OFFER_HASH` precisa estar no `.env`. Ver `docs/DIRECTPAG.md` —
 * há um comando que cria os dois e imprime o hash.
 *
 * ── O CPF é obrigatório ───────────────────────────────────────────────────
 *
 * `customer.document` é exigido em toda transação. Isso muda o formulário: o
 * checkout desta versão pede CPF, o do Mercado Pago não pedia. Não há como
 * contornar pelo lado da API.
 *
 * ── Cartão passa pelo nosso servidor ──────────────────────────────────────
 *
 * A API recebe `card: { number, holder_name, exp_month, exp_year, cvv }` em
 * texto. Não há tokenização no navegador nem cofre de cartão — diferente do
 * Payment Brick do Mercado Pago, onde o número nunca tocava a nossa máquina.
 *
 * Isso tem consequência de conformidade: aceitar o número cru move a operação
 * de SAQ A para SAQ D no PCI-DSS, e um vazamento nosso vira vazamento de
 * cartão. **A recomendação é habilitar só Pix e boleto** (ver
 * `METODOS_HABILITADOS` abaixo) e só ligar cartão depois de uma decisão
 * consciente sobre isso.
 */

const BASE = 'https://api.directpag.com.br/api/public/v1';

/**
 * Quais métodos a loja aceita.
 *
 * `credit_card` fora por padrão — ver a nota sobre PCI acima. Ligar é uma
 * linha, e é uma decisão que merece ser tomada de propósito, não herdada.
 */
export const METODOS_HABILITADOS: readonly string[] = ['pix', 'billet'];

function token(): string {
  const t = process.env.DIRECTPAG_API_TOKEN?.trim();
  if (!t) throw new Error('DIRECTPAG_API_TOKEN ausente');
  return t;
}

function ofertaPadrao(): string {
  const h = process.env.DIRECTPAG_OFFER_HASH?.trim();
  if (!h) throw new Error('DIRECTPAG_OFFER_HASH ausente — ver docs/DIRECTPAG.md');
  return h;
}

/** Tira o token de qualquer texto antes de ele virar log ou mensagem. */
function semSegredo(texto: string): string {
  const t = process.env.DIRECTPAG_API_TOKEN?.trim();
  return t ? texto.split(t).join('***') : texto;
}

async function chamar<T>(
  caminho: string,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const params = new URLSearchParams({ api_token: token(), ...(opcoes.query ?? {}) });
  const url = `${BASE}${caminho}?${params}`;

  const resposta = await fetch(url, {
    method: opcoes.metodo ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...(opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
    // Uma compra travada em 40 segundos é uma compra perdida.
    signal: AbortSignal.timeout(15_000),
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    throw new Error(semSegredo(`DirectPag ${resposta.status}: ${texto.slice(0, 300)}`));
  }

  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new Error(semSegredo(`DirectPag devolveu resposta ilegível: ${texto.slice(0, 200)}`));
  }
}

interface RespostaDirectPag<T> {
  success: boolean;
  data: T;
}

interface TransacaoDirectPag {
  hash: string;
  customer?: { email?: string } | null;
  status: string;
  amount?: number;
  payment_method?: string;
  qr_code?: string;
  pix_code?: string;
  billet_url?: string;
  external_reference?: string | null;
  fee?: number;
  net_amount?: number;
  metadata?: { pedido_id?: string } | null;
}

/**
 * O corpo da transação.
 *
 * **O valor NUNCA vem do cliente.** Ele é relido do produto no servidor e o
 * desconto chega já lido do pedido no banco — cupom mandado pelo navegador na
 * hora de cobrar seria preço editável com um passo a mais.
 */
export function montarCorpo(dados: DadosCriacao) {
  const preco = precoComDesconto(dados.produto, dados.descontoPercentual);

  return {
    amount: preco.finalCentavos,
    offer_hash: ofertaPadrao(),
    payment_method: dados.metodo,
    ...(dados.metodo === 'credit_card' && dados.cartao
      ? {
          card: {
            number: dados.cartao.numero,
            holder_name: dados.cartao.nome,
            exp_month: dados.cartao.mesValidade,
            exp_year: dados.cartao.anoValidade,
            cvv: dados.cartao.cvv,
          },
          installments: dados.parcelas ?? 1,
        }
      : {}),
    customer: {
      name: dados.pagador.nome,
      email: dados.pagador.email,
      phone_number: dados.pagador.telefone.replace(/\D/g, ''),
      document: dados.pagador.documento.replace(/\D/g, ''),
    },
    cart: [
      {
        product_hash: process.env.DIRECTPAG_PRODUCT_HASH ?? '',
        title: dados.produto.descricao,
        price: preco.finalCentavos,
        quantity: 1,
        operation_type: 1,
        tangible: false,
      },
    ],
    expire_in_days: 1,
    transaction_origin: 'api',
    /**
     * A referência que o webhook usa para reencontrar o pedido. Vai em dois
     * lugares porque a documentação do DirectPag não garante qual deles volta
     * no postback — e um pagamento órfão é uma pessoa que pagou e não recebeu.
     */
    external_reference: dados.pedidoId,
    metadata: { pedido_id: dados.pedidoId },
    ...(dados.rastreio ? { tracking: dados.rastreio } : {}),
    postback_url: `${process.env.BASE_URL ?? ''}/api/webhook`,
  };
}

function traduzir(t: TransacaoDirectPag): ResultadoPagamento {
  return {
    idExterno: t.hash,
    status: t.status,
    statusDetalhe: t.status,
    referenciaExterna: t.external_reference ?? t.metadata?.pedido_id ?? null,
    brutoCentavos: t.amount ?? null,
    taxaCentavos: t.fee ?? null,
    liquidoCentavos: t.net_amount ?? null,
    metodo: t.payment_method ?? null,
    emailDoPagador: t.customer?.email ?? null,
    ...(t.pix_code
      ? { pix: { copiaECola: t.pix_code, qrBase64: t.qr_code ?? '' } }
      : {}),
    ...(t.billet_url ? { boleto: { url: t.billet_url } } : {}),
  };
}

/**
 * Os status que liberam a entrega.
 *
 * Lista de permissão, não de negação: um status novo que o DirectPag inventar
 * amanhã não pode liberar entrega por omissão. Errar para o lado de não
 * entregar é recuperável — a reconciliação acha e reprocessa; errar para o
 * lado de entregar sem receber, não.
 */
const STATUS_QUE_LIBERAM = new Set(['paid', 'approved']);

export function statusLiberaAcesso(status: string): boolean {
  return STATUS_QUE_LIBERAM.has(status.trim().toLowerCase());
}

class ProvedorDirectPag implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    if (!METODOS_HABILITADOS.includes(dados.metodo)) {
      throw new Error(`método de pagamento não habilitado: ${dados.metodo}`);
    }
    const r = await chamar<RespostaDirectPag<TransacaoDirectPag>>('/transactions', {
      metodo: 'POST',
      corpo: montarCorpo(dados),
    });
    return traduzir(r.data);
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      const r = await chamar<RespostaDirectPag<TransacaoDirectPag>>(
        `/transactions/${encodeURIComponent(idExterno)}`
      );
      return traduzir(r.data);
    } catch {
      return null;
    }
  }

  async estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      await chamar(`/transactions/${encodeURIComponent(idExterno)}/refund`, {
        metodo: 'POST',
      });
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  }

  async listarPagosNoPeriodo(desde: Date, ate: Date): Promise<PagamentoResumido[]> {
    try {
      const r = await chamar<RespostaDirectPag<TransacaoDirectPag[]>>('/transactions', {
        query: {
          status: 'paid',
          per_page: '100',
          start_date: desde.toISOString().slice(0, 10),
          end_date: ate.toISOString().slice(0, 10),
        },
      });
      return (r.data ?? []).map((t) => ({
        idExterno: t.hash,
        status: t.status,
        referenciaExterna: t.external_reference ?? t.metadata?.pedido_id ?? null,
      }));
    } catch (erro) {
      console.error('[directpag] listar falhou:', semSegredo(String(erro)));
      return [];
    }
  }
}

export const pagamento: ProvedorPagamento = new ProvedorDirectPag();

/** `true` quando não há credencial — o checkout usa o modo de teste local. */
export function pagamentoEhFake(): boolean {
  return !process.env.DIRECTPAG_API_TOKEN?.trim();
}

export type { Cobravel };
