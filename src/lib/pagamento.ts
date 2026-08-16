import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';
import { randomUUID } from 'crypto';
import { type Produto } from './produtos';
import { precoComDesconto } from './cupons';

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
  /**
   * O dinheiro, como o Mercado Pago conta. Guardado por venda para o painel
   * saber o lucro REAL sem ninguém digitar percentual de taxa à mão — a taxa
   * muda por método (Pix é bem menor que cartão) e por parcelamento.
   *
   * `null` quando o provedor não informou (Pix ainda pendente, provedor fake).
   */
  brutoCentavos: number | null;
  taxaCentavos: number | null;
  liquidoCentavos: number | null;
  /** `pix`, `master`, `visa`, ... conforme o MP. */
  metodo: string | null;
  /** Só em Pix: código copia-e-cola e imagem do QR. */
  pix?: { copiaECola: string; qrBase64: string };
}

/**
 * `transaction_amount` NUNCA vem do cliente. O Brick manda um valor no
 * formData, mas confiar nele deixaria o preço editável pelo navegador — o
 * valor é sempre relido do produto no servidor.
 *
 * O mesmo vale para o desconto: o percentual chega daqui já lido do pedido no
 * banco, nunca do corpo da requisição. Cupom mandado pelo cliente na hora de
 * cobrar seria preço editável com passo extra.
 */
export function montarCorpo(
  form: FormDataBrick,
  produto: Produto,
  pedidoId: string,
  emailDoPedido: string,
  descontoPercentual: number
) {
  const preco = precoComDesconto(produto, descontoPercentual);
  const base = {
    transaction_amount: preco.finalCentavos / 100,
    description: produto.descricao,
    external_reference: pedidoId,
    statement_descriptor: 'BRUXARIO',
    metadata: {
      pedido_id: pedidoId,
      produto: produto.id,
      ...(preco.descontoPercentual ? { desconto: preco.descontoPercentual } : {}),
    },
    payer: {
      // O Mercado Pago RECUSA a cobrança sem um `payer.email` sintaticamente
      // válido. Pedidos do funil de anúncio podem nascer sem e-mail (quem não
      // aceitou os termos), e nesse caso vale o que o Brick coletou; se nem
      // isso houver, um endereço do nosso próprio domínio, único por pedido —
      // nunca um `example.com`, que o MP marca como suspeito.
      email: form.payer?.email || emailDoPedido || `pedido+${pedidoId}@bruxario.com.br`,
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
  /**
   * Já validado e gravado no pedido. Zero quando não há cupom.
   *
   * **Obrigatório de propósito.** Nasceu opcional, e o resultado foi um Pix
   * cobrando R$ 18,90 num pedido com 20% de desconto: a rota que chama esta
   * função simplesmente não passava o campo, e o `?? 0` engolia o erro sem
   * o TypeScript reclamar. Campo que decide preço não pode ter valor padrão.
   */
  descontoPercentual: number;
}

/** O suficiente pra reconciliação achar o pedido — detalhe financeiro completo vem de `consultarPagamento`. */
export interface PagamentoResumido {
  idExterno: string;
  status: string;
  referenciaExterna: string | null;
}

export interface ProvedorPagamento {
  criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento>;
  consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null>;
  /** Estorno integral. Devolve o motivo da falha em vez de lançar. */
  estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }>;
  /**
   * Todo pagamento aprovado pelo MP num intervalo, pela data em que foi
   * aprovado — para a reconciliação (`src/nucleo/reconciliacao.ts`) comparar
   * com o que o webhook gravou aqui. `[]` em caso de erro: reconciliação que
   * não roda hoje tenta de novo amanhã; não é motivo para lançar.
   */
  listarPagosNoPeriodo(desde: Date, ate: Date): Promise<PagamentoResumido[]>;
}

class ProvedorMercadoPago implements ProvedorPagamento {
  private pagamentos: Payment;
  private cliente: MercadoPagoConfig;

  constructor(accessToken: string) {
    // timeout curto: uma compra travada em 40s é uma compra perdida
    this.cliente = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 8000 },
    });
    this.pagamentos = new Payment(this.cliente);
  }

  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const { form, produto, pedidoId, emailDoPedido, descontoPercentual } = dados;

    const resposta = await this.pagamentos.create({
      body: montarCorpo(form, produto, pedidoId, emailDoPedido, descontoPercentual),
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

  /**
   * Estorno integral.
   *
   * Devolve `{ ok: false, erro }` em vez de lançar porque quem chama é uma
   * tela de painel: o dono precisa ver o motivo ("já estornado", "prazo
   * expirado") e decidir, não um 500 genérico.
   *
   * `idempotencyKey` derivada do pagamento, e não aleatória: dois cliques no
   * botão não podem virar dois estornos.
   */
  async estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const estornos = new PaymentRefund(this.cliente);
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
      console.error(`[pagamento] falha ao estornar ${idExterno}:`, erro);
      return { ok: false, erro: mensagem };
    }
  }

  async listarPagosNoPeriodo(desde: Date, ate: Date): Promise<PagamentoResumido[]> {
    const resumidos: PagamentoResumido[] = [];
    let offset = 0;
    const limite = 50;

    try {
      // Pagina até esgotar — em operação deste tamanho a janela de
      // reconciliação (tipicamente 1 dia) não passa de umas poucas páginas.
      for (;;) {
        const pagina = await this.pagamentos.search({
          options: {
            range: 'date_approved',
            begin_date: desde.toISOString(),
            end_date: ate.toISOString(),
            sort: 'date_approved',
            criteria: 'asc',
            limit: limite,
            offset,
          },
        });

        const resultados = pagina.results ?? [];
        for (const r of resultados) {
          resumidos.push({
            idExterno: String(r.id ?? ''),
            status: r.status ?? 'unknown',
            referenciaExterna: r.external_reference ?? null,
          });
        }

        offset += limite;
        if (resultados.length < limite || offset >= (pagina.paging?.total ?? 0)) break;
      }
    } catch (erro) {
      console.error('[pagamento] falha ao listar período para reconciliação:', erro);
      return [];
    }

    return resumidos;
  }
}

interface RespostaMP {
  id?: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  /** Cada taxa cobrada pelo MP na transação (`mercadopago_fee`, etc.). */
  fee_details?: { type?: string; amount?: number }[];
  transaction_details?: { net_received_amount?: number };
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

/** Reais (como o MP devolve) para centavos inteiros, sem erro de float. */
function emCentavos(valor: number | undefined): number | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  return Math.round(valor * 100);
}

function traduzir(r: RespostaMP): ResultadoPagamento {
  const pix = r.point_of_interaction?.transaction_data;

  /**
   * A taxa vem somada de `fee_details`, e não de `bruto - líquido`.
   *
   * Os dois normalmente batem, mas `net_received_amount` só aparece depois
   * que o pagamento é aprovado — em Pix pendente ele vem zerado ou ausente, e
   * a subtração daria "taxa = valor inteiro". Somar as taxas declaradas é o
   * número que o MP diz ter cobrado, que é o que a contabilidade quer.
   */
  const taxas = (r.fee_details ?? []).reduce(
    (soma, f) => soma + (typeof f.amount === 'number' ? f.amount : 0),
    0
  );

  return {
    idExterno: String(r.id ?? ''),
    status: r.status ?? 'unknown',
    statusDetalhe: r.status_detail ?? '',
    referenciaExterna: r.external_reference ?? null,
    brutoCentavos: emCentavos(r.transaction_amount),
    taxaCentavos: r.fee_details?.length ? emCentavos(taxas) : null,
    liquidoCentavos: emCentavos(r.transaction_details?.net_received_amount),
    metodo: r.payment_method_id ?? r.payment_type_id ?? null,
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
      // Sem gateway não existe taxa nem líquido: `null` para o painel não
      // contabilizar dinheiro imaginário como receita real.
      brutoCentavos: null,
      taxaCentavos: null,
      liquidoCentavos: null,
      metodo: 'fake',
    };
  }

  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento> {
    return {
      idExterno,
      status: 'approved',
      statusDetalhe: 'accredited_fake',
      referenciaExterna: idExterno.replace(/^fake_/, ''),
      brutoCentavos: null,
      taxaCentavos: null,
      liquidoCentavos: null,
      metodo: 'fake',
    };
  }

  async estornar(): Promise<{ ok: boolean; erro?: string }> {
    return { ok: true };
  }

  // Sem gateway não existe histórico pra reconciliar contra.
  async listarPagosNoPeriodo(): Promise<PagamentoResumido[]> {
    return [];
  }
}

/* ── modo de operação ─────────────────────────────────────────────────────
 *
 * Três modos, e a diferença entre eles é dinheiro de verdade:
 *
 *   fake      sem credencial nenhuma. Aprova na hora, não fala com o MP.
 *             Serve para tocar o fluxo inteiro sem gateway.
 *   teste     credenciais TEST- do Mercado Pago. Cartões de teste, nenhuma
 *             cobrança real, mas o fluxo é o de verdade — inclusive webhook.
 *   producao  credenciais APP_USR-. Cobra de verdade.
 *
 * A chave pública **não** usa o prefixo `NEXT_PUBLIC_` de propósito. O Next
 * congela variáveis com esse prefixo no momento do build, o que obrigaria a
 * reconstruir a aplicação para trocar de modo. Como ela é lida num server
 * component e passada como prop para o Brick, ela nunca precisou do prefixo —
 * e sem ele, trocar `MP_MODO` e reiniciar basta.
 */
export type ModoPagamento = 'fake' | 'teste' | 'producao';

interface Credenciais {
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
}

function credenciaisDe(modo: 'teste' | 'producao'): Credenciais {
  const p = modo === 'producao' ? 'MP_PROD' : 'MP_TESTE';
  return {
    accessToken: process.env[`${p}_ACCESS_TOKEN`] || undefined,
    publicKey: process.env[`${p}_PUBLIC_KEY`] || undefined,
    // O segredo do webhook é da aplicação, não do par de credenciais — por
    // isso o campo único também vale, e o específico só sobrescreve.
    webhookSecret:
      process.env[`${p}_WEBHOOK_SECRET`] ||
      process.env.MP_WEBHOOK_SECRET ||
      undefined,
  };
}

/**
 * O modo pedido no `.env`. Padrão **teste**, de propósito: esquecer de
 * configurar não pode resultar em cobrar alguém sem querer.
 */
function modoPedido(): 'teste' | 'producao' {
  return process.env.MP_MODO?.trim().toLowerCase() === 'producao'
    ? 'producao'
    : 'teste';
}

/** O modo que está de fato valendo — cai para `fake` se faltar credencial. */
export function modoAtual(): ModoPagamento {
  const { accessToken } = credenciaisDe(modoPedido());
  return accessToken ? modoPedido() : 'fake';
}

/**
 * Avisa quando o par de credenciais não combina com o modo declarado.
 *
 * Tokens de produção começam com `APP_USR-` e os de teste com `TEST-`. Colar
 * o par errado é fácil (as duas telas do painel são idênticas) e o sintoma é
 * confuso: ou cobra de verdade achando que é teste, ou recusa tudo sem
 * explicar. Melhor gritar no log.
 */
export function conferirCoerencia(): string | null {
  const modo = modoPedido();
  const { accessToken } = credenciaisDe(modo);
  if (!accessToken) return null;

  const pareceProducao = accessToken.startsWith('APP_USR-');
  const pareceTeste = accessToken.startsWith('TEST-');

  if (modo === 'producao' && pareceTeste) {
    return 'MP_MODO=producao mas MP_PROD_ACCESS_TOKEN é um token TEST- — nada será cobrado.';
  }
  if (modo === 'teste' && pareceProducao) {
    return 'MP_MODO=teste mas MP_TESTE_ACCESS_TOKEN é um token APP_USR- de PRODUÇÃO — isso COBRA DE VERDADE.';
  }
  return null;
}

// Reavalia a cada chamada em vez de fixar um singleton na primeira importação,
// para que trocar o modo no .env passe a valer sem derrubar o processo.
function obterProvedor(): ProvedorPagamento {
  const { accessToken } = credenciaisDe(modoPedido());
  if (!accessToken) return new ProvedorFake();

  const alerta = conferirCoerencia();
  if (alerta) console.warn(`[pagamento] ⚠️  ${alerta}`);

  return new ProvedorMercadoPago(accessToken);
}

export const pagamento: ProvedorPagamento = {
  criarPagamento: (dados) => obterProvedor().criarPagamento(dados),
  consultarPagamento: (id) => obterProvedor().consultarPagamento(id),
  estornar: (id) => obterProvedor().estornar(id),
  listarPagosNoPeriodo: (desde, ate) => obterProvedor().listarPagosNoPeriodo(desde, ate),
};

export function pagamentoEhFake(): boolean {
  return modoAtual() === 'fake';
}

/** Chave pública do Brick, do par correspondente ao modo atual. */
export function chavePublica(): string | undefined {
  return credenciaisDe(modoPedido()).publicKey;
}

/** Segredo de validação do webhook, do par correspondente ao modo atual. */
export function segredoDoWebhook(): string | undefined {
  return credenciaisDe(modoPedido()).webhookSecret;
}

/** Só `approved` libera acesso. `pending` (Pix não pago) e `in_process` não. */
export function statusLiberaAcesso(status: string): boolean {
  return status === 'approved';
}
