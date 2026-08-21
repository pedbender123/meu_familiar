/**
 * O contrato de um provedor de pagamento — o que o resto do sistema conhece.
 *
 * Nasceu do adaptador do Mercado Pago e ficou aqui quando o DirectPag entrou:
 * um provedor concreto não deve ser o dono da interface que os outros
 * implementam, senão trocar de provedor exige mexer no que ficou.
 */

/** O mínimo para cobrar: id, o que aparece na fatura, e quanto. */
export interface Cobravel {
  id: string;
  descricao: string;
  precoCentavos: number;
}

/** O que o formulário de pagamento manda. Nunca o VALOR — ver `montarCorpo`. */
export interface DadosDoCartao {
  numero: string;
  nome: string;
  mesValidade: string;
  anoValidade: string;
  cvv: string;
}

export interface DadosDoPagador {
  nome: string;
  email: string;
  telefone: string;
  /** CPF ou CNPJ, só números. **Obrigatório no DirectPag.** */
  documento: string;
}

export type MetodoDePagamento = 'pix' | 'credit_card' | 'billet';

export interface DadosCriacao {
  metodo: MetodoDePagamento;
  pagador: DadosDoPagador;
  cartao?: DadosDoCartao;
  parcelas?: number;
  produto: Cobravel;
  pedidoId: string;
  /**
   * Já validado e gravado no pedido. Zero quando não há cupom.
   *
   * **Obrigatório de propósito.** Nasceu opcional, e o resultado foi um Pix
   * cobrando o preço cheio num pedido com 20% de desconto: a rota que chamava
   * simplesmente não passava o campo, e o `?? 0` engolia o erro sem o
   * TypeScript reclamar. Campo que decide preço não pode ter valor padrão.
   */
  descontoPercentual: number;
  /** UTMs da chegada, para o gateway devolver na conciliação. */
  rastreio?: Record<string, string>;
}

export interface ResultadoPagamento {
  /** ID do pagamento no provedor — guardado para casar com o webhook. */
  idExterno: string;
  /** `pending`, `paid`, `canceled`, `refunded`, ... conforme o provedor. */
  status: string;
  statusDetalhe: string;
  /**
   * O nosso `pedidoId`, gravado como referência externa na criação. É como o
   * webhook reencontra o pedido quando ainda não há `pagamento_id` salvo — a
   * notificação pode chegar antes de a resposta síncrona voltar.
   */
  referenciaExterna: string | null;
  /**
   * O dinheiro, como o provedor conta. Guardado por venda para o painel saber
   * o lucro REAL sem ninguém digitar percentual de taxa à mão — a taxa muda
   * por método (Pix é bem menor que cartão) e por parcelamento.
   *
   * `null` quando o provedor não informou (Pix ainda pendente).
   */
  brutoCentavos: number | null;
  taxaCentavos: number | null;
  liquidoCentavos: number | null;
  metodo: string | null;
  /** Só em Pix: código copia-e-cola e imagem do QR. */
  pix?: { copiaECola: string; qrBase64: string };
  /** Só em boleto: o PDF para imprimir. */
  boleto?: { url: string };
}

/** O suficiente para a reconciliação achar o pedido. */
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
   * Todo pagamento aprovado num intervalo, pela data de aprovação — para a
   * reconciliação comparar com o que o webhook gravou aqui. `[]` em caso de
   * erro: reconciliação que não roda hoje tenta de novo amanhã; não é motivo
   * para lançar.
   */
  listarPagosNoPeriodo(desde: Date, ate: Date): Promise<PagamentoResumido[]>;
}
