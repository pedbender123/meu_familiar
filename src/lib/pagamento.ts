import { MercadoPagoConfig, Payment } from 'mercadopago';
import { randomUUID } from 'crypto';
import { precoEmReais, type Produto } from './produtos';

/**
 * Mercado Pago via **Payment Brick** (SPEC 0.5 e 10.1, travado).
 *
 * A diferença estrutural em relação ao Asaas que isto substituiu: o Asaas usava
 * Checkout hospedado, então bastava criar a cobrança e redirecionar. O Payment
 * Brick renderiza o formulário **dentro do nosso site** — o SPEC 10.3 pede isso
 * de propósito, porque "mandar alguém do meio de um ritual de vela e lua para
 * uma tela laranja e voltar" quebra a ambientação.
 *
 * Consequência prática: não existe mais "URL de checkout" para onde
 * redirecionar. O fluxo passa a ser:
 *
 *   1. o Brick coleta os dados no navegador e gera um `token` (dado de cartão
 *      nunca toca nosso servidor — é o que mantém a conformidade PCI)
 *   2. o Brick chama nosso backend com o formData
 *   3. este módulo cria o pagamento em POST /v1/payments
 *   4. o **webhook** confirma. Nunca a resposta síncrona (SPEC 10.6)
 *
 * Cartão aprovado volta `approved` na hora; Pix volta `pending` com o QR code.
 * Em nenhum dos dois casos a resposta síncrona libera acesso — só o webhook.
 */

/** O que o Payment Brick entrega no `onSubmit`. Campos variam por meio. */
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
  /** ID do pagamento no Mercado Pago — guardado para casar com o webhook. */
  idExterno: string;
  /** `approved`, `pending`, `rejected`, ... conforme o MP. */
  status: string;
  statusDetalhe: string;
  /**
   * O nosso `pedidoId`, que gravamos como `external_reference` na criação.
   * É como o webhook reencontra o pedido quando ainda não há `pagamento_id`
   * salvo (a notificação pode chegar antes de a resposta síncrona voltar).
   */
  referenciaExterna: string | null;
  /** Só em Pix: código copia-e-cola e imagem do QR. */
  pix?: { copiaECola: string; qrBase64: string };
}

/**
 * `transaction_amount` NUNCA vem do cliente. O Brick manda um valor no
 * formData, mas confiar nele deixaria o preço editável pelo navegador — o
 * valor é sempre relido do produto no servidor.
 */
function montarCorpo(
  form: FormDataBrick,
  produto: Produto,
  pedidoId: string,
  emailDoPedido: string
) {
  const base = {
    transaction_amount: precoEmReais(produto),
    description: produto.descricao,
    external_reference: pedidoId,
    statement_descriptor: 'BRUXARIO',
    metadata: { pedido_id: pedidoId, produto: produto.id },
    payer: {
      email: form.payer?.email || emailDoPedido,
      ...(form.payer?.first_name ? { first_name: form.payer.first_name } : {}),
      ...(form.payer?.last_name ? { last_name: form.payer.last_name } : {}),
      ...(form.payer?.identification?.number
        ? { identification: form.payer.identification }
        : {}),
    },
  };

  // Pix e boleto não têm token nem parcela; cartão exige os dois.
  if (form.token) {
    // O Brick manda `issuer_id` como string, a API espera número. Converter
    // sem checar deixaria `Number('')` virar 0 e o MP recusar o pagamento com
    // um erro que não diz o que houve.
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
  produto: Produto;
  pedidoId: string;
  emailDoPedido: string;
}

export interface ProvedorPagamento {
  criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento>;
  consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null>;
}

class ProvedorMercadoPago implements ProvedorPagamento {
  private pagamentos: Payment;

  constructor(accessToken: string) {
    // timeout curto: uma compra travada em 40s é uma compra perdida
    const cliente = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 8000 },
    });
    this.pagamentos = new Payment(cliente);
  }

  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const { form, produto, pedidoId, emailDoPedido } = dados;

    const resposta = await this.pagamentos.create({
      body: montarCorpo(form, produto, pedidoId, emailDoPedido),
      // Exigido pelo MP. Chave nova por tentativa: se a pessoa erra o cartão e
      // tenta de novo, é uma cobrança nova de verdade — reaproveitar a chave
      // faria o MP devolver o resultado antigo, com a recusa anterior.
      requestOptions: { idempotencyKey: randomUUID() },
    });

    return traduzir(resposta);
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      return traduzir(await this.pagamentos.get({ id: idExterno }));
    } catch (erro) {
      console.error(`[pagamento] falha ao consultar ${idExterno}:`, erro);
      return null;
    }
  }
}

interface RespostaMP {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
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
    ...(pix?.qr_code
      ? { pix: { copiaECola: pix.qr_code, qrBase64: pix.qr_code_base64 ?? '' } }
      : {}),
  };
}

/**
 * Sem credencial configurada, aprova na hora. Mantém o fluxo completo
 * (quiz → leitura → artes → link) testável sem gateway nenhum, que é como o
 * projeto foi desenvolvido até aqui.
 */
class ProvedorFake implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    return {
      idExterno: `fake_${dados.pedidoId}`,
      status: 'approved',
      statusDetalhe: 'accredited_fake',
      referenciaExterna: dados.pedidoId,
    };
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento> {
    return {
      idExterno,
      status: 'approved',
      statusDetalhe: 'accredited_fake',
      referenciaExterna: idExterno.replace(/^fake_/, ''),
    };
  }
}

function tokenDeAcesso(): string | undefined {
  return process.env.MP_ACCESS_TOKEN;
}

// Reavalia a cada chamada em vez de fixar um singleton na primeira importação,
// para que preencher o .env passe a valer sem derrubar o processo.
function obterProvedor(): ProvedorPagamento {
  const token = tokenDeAcesso();
  return token ? new ProvedorMercadoPago(token) : new ProvedorFake();
}

export const pagamento: ProvedorPagamento = {
  criarPagamento: (dados) => obterProvedor().criarPagamento(dados),
  consultarPagamento: (id) => obterProvedor().consultarPagamento(id),
};

export function pagamentoEhFake(): boolean {
  return !tokenDeAcesso();
}

/** Chave pública do Brick — vai pro navegador, por isso `NEXT_PUBLIC_`. */
export function chavePublica(): string | undefined {
  return process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
}

/** Só `approved` libera acesso. `pending` (Pix não pago) e `in_process` não. */
export function statusLiberaAcesso(status: string): boolean {
  return status === 'approved';
}
