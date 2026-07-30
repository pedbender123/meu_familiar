/**
 * O que o Bruxário vende.
 *
 * Este arquivo é a **fonte de verdade única**: a tabela de preços da landing é
 * gerada daqui, o valor cobrado no Mercado Pago é lido daqui, e o que cada
 * pessoa pode acessar é decidido daqui. Não existe o caso de a tela prometer o
 * que o backend não libera, porque as duas coisas leem o mesmo objeto.
 *
 * ── A forma dos três ──────────────────────────────────────────────────────
 *
 * **Revelação (R$ 9,80)** — o familiar e uma leitura curta, bonita e sem
 * firula. Entrega em PDF e imagens, e o endereço **expira**. É o produto de
 * porta de entrada.
 *
 * **Link permanente (R$ 5,90)** — adicional, oferecido a quem já comprou a
 * Revelação e está prestes a perder o link. Congela o endereço para sempre,
 * mas **não** dá o relatório completo nem a conta. Existe para capturar quem
 * quer guardar sem querer o pacote inteiro.
 *
 * **Completa (R$ 18,90)** — exige criar conta no Bruxário. Traz o relatório
 * longo com os gráficos do que o teste realmente mede, o perfil público com
 * URL própria, e as 3 consultas ao Oráculo quando ele abrir.
 *
 * ── Por que a Revelação expira ────────────────────────────────────────────
 *
 * Porque o endereço permanente é o que a Completa vende, e um produto de
 * R$ 9,80 que já entrega isso não deixa razão para o de R$ 18,90 existir.
 *
 * **Nota de rota:** o SPEC 0.3 decidiu o contrário — carta compartilhável
 * grátis para todos, inclusive não-compradores, como motor de aquisição. A
 * inversão foi decisão do dono do produto em jul/2026, com a ressalva
 * registrada: prender o compartilhamento no plano caro significa que só quem
 * paga mais divulga. O contrapeso escolhido foi manter PDF **e imagens** na
 * Revelação, para que ela ainda circule no Instagram sem levar o perfil.
 */
export type ProdutoId = 'revelacao' | 'link_permanente' | 'completa';

/**
 * Sete dias, e o número não é arbitrário: é o prazo de arrependimento do
 * Código de Defesa do Consumidor (art. 49), que o SPEC 7.5-B manda tratar como
 * benefício e não como letra miúda.
 *
 * O alinhamento resolve um problema sozinho — o link só some **depois** que o
 * direito de reembolso já passou. Ninguém perde o acesso ainda podendo pedir
 * dinheiro de volta, que seria a pior combinação possível para o suporte.
 */
export const DIAS_DE_ACESSO_TEMPORARIO = 7;

export interface Produto {
  id: ProdutoId;
  nome: string;
  precoCentavos: number;
  /** Vai no `description` do pagamento no Mercado Pago. */
  descricao: string;

  /** `adicional` não é comprável sozinho — só a partir de um pedido existente. */
  tipo: 'principal' | 'adicional';

  /** `null` = para sempre. Número = dias até o endereço expirar. */
  diasDeAcesso: number | null;

  /** Exige criar conta no Bruxário (link mágico por e-mail). */
  exigeConta: boolean;

  pdf: boolean;
  imagens: boolean;
  /** Leitura longa em vez da curta. */
  relatorioCompleto: boolean;
  /** Os gráficos do que o teste mede — eixos e a roda dos 12. */
  graficos: boolean;
  /** Perfil público com URL própria. */
  perfilPublico: boolean;
  tiragemDiaria: boolean;
  /** Consultas ao Oráculo liberadas quando ele abrir (SPEC 0.4). */
  perguntasOraculo: number;
}

export const PRODUTOS: Record<ProdutoId, Produto> = {
  revelacao: {
    id: 'revelacao',
    nome: 'Revelação',
    precoCentavos: 980,
    descricao: 'Revelação do seu familiar, em PDF e imagens',
    tipo: 'principal',
    diasDeAcesso: DIAS_DE_ACESSO_TEMPORARIO,
    exigeConta: false,
    pdf: true,
    imagens: true,
    relatorioCompleto: false,
    graficos: false,
    perfilPublico: false,
    tiragemDiaria: false,
    perguntasOraculo: 0,
  },

  link_permanente: {
    id: 'link_permanente',
    nome: 'Link permanente',
    precoCentavos: 590,
    descricao: 'Seu link de revelação, para sempre',
    tipo: 'adicional',
    diasDeAcesso: null,
    exigeConta: false,
    pdf: true,
    imagens: true,
    relatorioCompleto: false,
    graficos: false,
    perfilPublico: false,
    tiragemDiaria: false,
    perguntasOraculo: 0,
  },

  completa: {
    id: 'completa',
    nome: 'Completa',
    precoCentavos: 1890,
    descricao: 'Leitura longa, gráficos do seu perfil e conta no Bruxário',
    tipo: 'principal',
    diasDeAcesso: null,
    exigeConta: true,
    pdf: true,
    imagens: true,
    relatorioCompleto: true,
    graficos: true,
    perfilPublico: true,
    tiragemDiaria: true,
    perguntasOraculo: 3,
  },
};

/** Os que a pessoa escolhe antes de pagar. O adicional não entra aqui. */
export const PRODUTOS_PRINCIPAIS = [PRODUTOS.revelacao, PRODUTOS.completa];

export const PRODUTO_PADRAO: ProdutoId = 'revelacao';

export function ehProdutoValido(valor: unknown): valor is ProdutoId {
  return typeof valor === 'string' && valor in PRODUTOS;
}

export function produtoDe(id: string): Produto {
  return PRODUTOS[ehProdutoValido(id) ? id : PRODUTO_PADRAO];
}

/** "9,80" — para a UI, que nunca deve fazer essa conta sozinha. */
export function precoFormatado(produto: Produto): string {
  return (produto.precoCentavos / 100).toFixed(2).replace('.', ',');
}

/** Reais, como o Mercado Pago espera em `transaction_amount`. */
export function precoEmReais(produto: Produto): number {
  return produto.precoCentavos / 100;
}

/**
 * Quando o acesso a um pedido expira, em ISO. `null` = nunca.
 *
 * Recebe a data de pagamento e não `Date.now()` de propósito: a contagem
 * começa quando a pessoa pagou, não quando alguém rodou esta função.
 */
export function calcularExpiracao(
  produto: Produto,
  pagoEm: Date
): string | null {
  if (produto.diasDeAcesso === null) return null;
  const fim = new Date(pagoEm);
  fim.setDate(fim.getDate() + produto.diasDeAcesso);
  return fim.toISOString();
}

/** Quantos dias inteiros faltam. Negativo quando já expirou. */
export function diasRestantes(expiraEm: string, agora = new Date()): number {
  const ms = new Date(expiraEm).getTime() - agora.getTime();
  return Math.ceil(ms / 86_400_000);
}

export function acessoExpirou(expiraEm: string | null, agora = new Date()): boolean {
  if (!expiraEm) return false;
  return new Date(expiraEm).getTime() <= agora.getTime();
}
