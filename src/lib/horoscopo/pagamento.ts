import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';
import { randomUUID } from 'crypto';

/**
 * Mercado Pago do Horóscopo — cópia deliberada do padrão de `lib/pagamento.ts`,
 * NÃO um import dele. O pedido foi explícito: aplicação MP própria, webhook
 * próprio, sem depender de nada do produto principal. Duplicar aqui é o preço
 * de isolamento de verdade — mudar a credencial ou o segredo de um produto
 * nunca risca o outro.
 */

const PRECO_HOROSCOPO_CENTAVOS = 1490;
const DESCRICAO_HOROSCOPO = 'Horóscopo Pessoal — Bruxário';

export interface FormDataBrick {
  token?: string;
  issuer_id?: string;
  payment_method_id: string;
  transaction_amount?: number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
    first_name?: string;
    last_name?: string;
  };
}

export interface ResultadoPagamento {
  idExterno: string;
  status: string;
  statusDetalhe: string;
  referenciaExterna: string | null;
  metodo: string | null;
  pix?: { copiaECola: string; qrBase64: string };
}

export function montarCorpo(form: FormDataBrick, pedidoId: string) {
  const base = {
    transaction_amount: PRECO_HOROSCOPO_CENTAVOS / 100,
    description: DESCRICAO_HOROSCOPO,
    external_reference: pedidoId,
    statement_descriptor: 'HOROSCOPO',
    metadata: { pedido_id: pedidoId, produto: 'horoscopo' },
    payer: {
      email: form.payer?.email || `horoscopo+${pedidoId}@bruxario.com.br`,
      ...(form.payer?.first_name ? { first_name: form.payer.first_name } : {}),
      ...(form.payer?.last_name ? { last_name: form.payer.last_name } : {}),
      ...(form.payer?.identification?.number
        ? { identification: form.payer.identification }
        : {}),
    },
  };

  if (form.token) {
    const emissor = Number(form.issuer_id);
    return {
      ...base,
      token: form.token,
      payment_method_id: form.payment_method_id,
      installments: form.installments ?? 1,
      ...(Number.isFinite(emissor) && emissor > 0 ? { issuer_id: emissor } : {}),
    };
  }
  return { ...base, payment_method_id: form.payment_method_id };
}

export interface DadosCriacao {
  form: FormDataBrick;
  pedidoId: string;
}

interface ProvedorPagamento {
  criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento>;
  consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null>;
}

class ProvedorMercadoPagoHoroscopo implements ProvedorPagamento {
  private pagamentos: Payment;

  constructor(accessToken: string) {
    const cliente = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    this.pagamentos = new Payment(cliente);
  }

  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const resposta = await this.pagamentos.create({
      body: montarCorpo(dados.form, dados.pedidoId),
      requestOptions: { idempotencyKey: randomUUID() },
    });
    return traduzir(resposta);
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      return traduzir(await this.pagamentos.get({ id: idExterno }));
    } catch (erro) {
      console.error(`[horoscopo/pagamento] falha ao consultar ${idExterno}:`, erro);
      return null;
    }
  }
}

interface RespostaMP {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

function traduzir(r: RespostaMP): ResultadoPagamento {
  const pix = r.point_of_interaction?.transaction_data;
  return {
    idExterno: String(r.id ?? ''),
    status: r.status ?? 'unknown',
    statusDetalhe: r.status_detail ?? '',
    referenciaExterna: r.external_reference ?? null,
    metodo: r.payment_method_id ?? r.payment_type_id ?? null,
    ...(pix?.qr_code
      ? { pix: { copiaECola: pix.qr_code, qrBase64: pix.qr_code_base64 ?? '' } }
      : {}),
  };
}

/** Sem credencial configurada: aprova na hora, sem falar com o MP. */
class ProvedorFakeHoroscopo implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    return {
      idExterno: `fake_${dados.pedidoId}`,
      status: 'approved',
      statusDetalhe: 'accredited_fake',
      referenciaExterna: dados.pedidoId,
      metodo: 'fake',
    };
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento> {
    return {
      idExterno,
      status: 'approved',
      statusDetalhe: 'accredited_fake',
      referenciaExterna: idExterno.replace(/^fake_/, ''),
      metodo: 'fake',
    };
  }
}

export type ModoPagamentoHoroscopo = 'fake' | 'teste' | 'producao';

interface Credenciais {
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
}

function credenciaisDe(modo: 'teste' | 'producao'): Credenciais {
  const p = modo === 'producao' ? 'MP_HOROSCOPO_PROD' : 'MP_HOROSCOPO_TESTE';
  return {
    accessToken: process.env[`${p}_ACCESS_TOKEN`] || undefined,
    publicKey: process.env[`${p}_PUBLIC_KEY`] || undefined,
    webhookSecret: process.env[`${p}_WEBHOOK_SECRET`] || undefined,
  };
}

function modoPedido(): 'teste' | 'producao' {
  return process.env.MP_HOROSCOPO_MODO?.trim().toLowerCase() === 'producao'
    ? 'producao'
    : 'teste';
}

export function modoAtualHoroscopo(): ModoPagamentoHoroscopo {
  const { accessToken } = credenciaisDe(modoPedido());
  return accessToken ? modoPedido() : 'fake';
}

function obterProvedor(): ProvedorPagamento {
  const { accessToken } = credenciaisDe(modoPedido());
  if (!accessToken) return new ProvedorFakeHoroscopo();
  return new ProvedorMercadoPagoHoroscopo(accessToken);
}

export const pagamentoHoroscopo = {
  criarPagamento: (dados: DadosCriacao) => obterProvedor().criarPagamento(dados),
  consultarPagamento: (id: string) => obterProvedor().consultarPagamento(id),
};

export function pagamentoHoroscopoEhFake(): boolean {
  return modoAtualHoroscopo() === 'fake';
}

export function chavePublicaHoroscopo(): string | undefined {
  return credenciaisDe(modoPedido()).publicKey;
}

export function segredoDoWebhookHoroscopo(): string | undefined {
  return credenciaisDe(modoPedido()).webhookSecret;
}

export function statusLiberaAcessoHoroscopo(status: string): boolean {
  return status === 'approved';
}

export { PRECO_HOROSCOPO_CENTAVOS };

/** Estorno — só usado no painel, se um dia existir um pro Horóscopo. */
export async function estornarHoroscopo(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
  const { accessToken } = credenciaisDe(modoPedido());
  if (!accessToken) return { ok: true };
  try {
    const cliente = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });
    const estornos = new PaymentRefund(cliente);
    await estornos.total({
      payment_id: idExterno,
      requestOptions: { idempotencyKey: `estorno-${idExterno}` },
    });
    return { ok: true };
  } catch (erro) {
    const mensagem =
      erro && typeof erro === 'object' && 'message' in erro
        ? String((erro as { message: unknown }).message)
        : String(erro);
    return { ok: false, erro: mensagem };
  }
}
