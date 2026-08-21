import { interruptorLigado } from './interruptores';
import { PRODUTOS, type ProdutoId } from './produtos';

/**
 * O desvio provisório: o modelo de venda novo atrás de um interruptor.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * O master mudou o negócio inteiro — a Revelação virou grátis e o que se vende
 * passou a ser assinatura. Produção está 57 commits atrás e com uma campanha
 * de anúncio rodando AGORA, vendendo a Revelação a R$ 9,80.
 *
 * Subir os dois de uma vez trocaria o preço no meio da campanha, sem aviso,
 * para quem já está no funil. O interruptor deixa subir o código sem trocar o
 * negócio: o site fica idêntico ao de hoje até alguém ligar a chave.
 *
 * É a disciplina 3 do projeto — "todo caminho novo nasce desligado" — aplicada
 * à mudança que mais mexe em dinheiro.
 *
 * ── O que o interruptor NÃO controla ──────────────────────────────────────
 *
 * A porta sem landing. Ela já foi para produção sozinha, em 19/08, e é o que
 * a campanha em curso está usando para converter — devolvê-la à landing seria
 * desfazer a mudança que fez o funil funcionar. O interruptor cuida só do
 * **dinheiro**: quanto custa, para onde vai depois da entrega, e se plano é
 * vendável.
 *
 * ── Como virar a chave ────────────────────────────────────────────────────
 *
 * Uma linha no banco, sem deploy:
 *
 * ```
 * npm run modelo-novo -- ligar     # Revelação grátis, venda por assinatura
 * npm run modelo-novo -- desligar  # volta ao de hoje, na hora
 * ```
 *
 * Desligar é o rollback: nenhum código muda, nada é revertido, e quem estiver
 * no meio de um pagamento continua com o preço que viu.
 */
export const CHAVE_DO_MODELO_NOVO = 'modelo_novo';

export function modeloNovoLigado(): boolean {
  return interruptorLigado(CHAVE_DO_MODELO_NOVO);
}

/**
 * O preço que vale AGORA para um produto.
 *
 * ── Por que não é o de `produtos.ts` direto ───────────────────────────────
 *
 * Porque lá a Revelação está zerada — ela virou a porta de entrada do modelo
 * novo. Com o interruptor desligado, ela precisa custar o que custava, senão
 * o funil de produção entrega de graça o que a campanha está vendendo.
 *
 * Mora aqui, e não dentro de `produtos.ts`, por um motivo prático: aquele
 * arquivo é importado por componente de cliente, e ler o banco lá dentro
 * arrastaria o `better-sqlite3` para o pacote do navegador.
 */
const PRECOS_DO_MODELO_ANTIGO: Partial<Record<ProdutoId, number>> = {
  // O que a campanha `a1` está vendendo hoje, em produção.
  revelacao: 980,
};

export function precoVigenteCentavos(id: ProdutoId): number {
  const doProduto = PRODUTOS[id]?.precoCentavos ?? 0;
  if (modeloNovoLigado()) return doProduto;
  return PRECOS_DO_MODELO_ANTIGO[id] ?? doProduto;
}

/** O produto com o preço vigente aplicado — para quem cobra e para quem exibe. */
export function produtoVigente(id: ProdutoId) {
  return { ...PRODUTOS[id], precoCentavos: precoVigenteCentavos(id) };
}

/**
 * Para onde vai quem acabou de receber o familiar.
 *
 * No modelo novo é a oferta de três degraus; no antigo é a revelação direto,
 * como produção faz hoje — a pessoa pagou pela leitura, então ela abre.
 */
export function destinoDepoisDaEntrega(pedidoId: string): string {
  return modeloNovoLigado() ? `/oferta/${pedidoId}` : `/revelacao/${pedidoId}`;
}
