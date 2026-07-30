/**
 * Os dois produtos do SPEC 0.3. Antes disso o preço era um `980` repetido em
 * dois arquivos, um deles hardcoded numa página de UI.
 *
 * Regra de precificação do SPEC: "o dobro do preço precisa ser legível na
 * tela". Por isso os benefícios moram aqui como dados e não como texto solto
 * no JSX — a tabela comparativa da tela de preço é gerada disto, e não há como
 * a tela prometer algo que o backend não entrega.
 */
export type ProdutoId = 'revelacao' | 'completa';

export interface Produto {
  id: ProdutoId;
  nome: string;
  precoCentavos: number;
  /** Vai no `description` do pagamento no Mercado Pago. */
  descricao: string;
  /** Quantas perguntas ao oráculo a compra libera (SPEC 0.3). */
  perguntasOraculo: number;
  leituraLonga: boolean;
  rodaDosDoze: boolean;
  perfilPublico: boolean;
  tiragemDiaria: boolean;
}

export const PRODUTOS: Record<ProdutoId, Produto> = {
  revelacao: {
    id: 'revelacao',
    nome: 'Revelação',
    precoCentavos: 980,
    descricao: 'Revelação do seu familiar + leitura essencial',
    perguntasOraculo: 3,
    leituraLonga: false,
    rodaDosDoze: false,
    perfilPublico: false,
    tiragemDiaria: false,
  },
  completa: {
    id: 'completa',
    nome: 'Completa',
    precoCentavos: 1890,
    descricao: 'Leitura longa, roda dos 12 escores e perfil permanente',
    perguntasOraculo: 6,
    leituraLonga: true,
    rodaDosDoze: true,
    perfilPublico: true,
    tiragemDiaria: true,
  },
};

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
