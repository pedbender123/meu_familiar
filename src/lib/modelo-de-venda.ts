import { interruptorLigado } from './interruptores';
import { PRODUTOS, PRODUTO_PADRAO, ehProdutoValido, type ProdutoId } from './produtos';

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
  /**
   * **Preço CHEIO, antes do cupom de lançamento.**
   *
   * O `LANCAMENTO20` é aplicado sozinho a todo pedido (ver
   * `CUPOM_DE_LANCAMENTO`), então o número aqui não é o que entra no caixa —
   * é o que entra menos 20%. Ficou 12 horas com 980 aqui, e o resultado foi
   * cobrar R$ 7,84 por uma venda anunciada a R$ 9,80: o desconto comeu a
   * margem em vez de servir de argumento.
   *
   * Agora o cheio absorve o cupom:
   *
   *     Revelação   12,25 − 20%  =   9,80
   *     Completa    23,62 − 20%  =  18,90
   *
   * **`precoComDesconto` arredonda para CIMA** (`Math.ceil`), não para o mais
   * próximo. Por isso a Completa é 2362 e não 2363: 2363 × 0,8 = 1890,4, que
   * o `ceil` empurra para 1891 e faz o cliente pagar um centavo a mais do que
   * o anunciado. Com 2362 dá 1889,6 → 1890, exato.
   *
   * Mexer num destes números sem refazer a conta muda o que o cliente paga —
   * o teste ao lado trava os dois resultados, não os dois preços cheios.
   */
  revelacao: 1225,
  /**
   * A Completa também passa por aqui agora.
   *
   * Antes ela não estava neste mapa e caía no valor de `produtos.ts` (1890),
   * que virava 15,12 depois do cupom. Só o preço da Revelação tinha sido
   * pensado com o desconto; o da Completa vazava.
   */
  completa: 2362,
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
 * Se plano pode ser vendido agora.
 *
 * ── Por que saiu de dentro do interruptor do modelo ───────────────────────
 *
 * A venda de plano estava amarrada a `modeloNovoLigado()`: com a chave
 * desligada, `abrirCobranca` devolvia `null` e **nenhum plano era cobrável**.
 *
 * A intenção era não vender assinatura num site cujo funil ainda é o antigo.
 * O efeito real era outro: `/planos` continuava anunciando os três planos com
 * preço na tela, e clicar em qualquer um respondia "plano indisponível".
 * Vitrine aberta com a porta trancada — e o banco confirma, zero cobranças de
 * plano desde que a página existe.
 *
 * O problema é que as duas coisas estavam na MESMA chave: ligar o modelo novo
 * para poder vender plano também zeraria o preço da Revelação, que é o que a
 * campanha está vendendo. Uma decisão não pode custar a outra.
 *
 * ── Por que nasce LIGADO, contra a disciplina 3 ───────────────────────────
 *
 * "Todo caminho novo nasce desligado" vale para caminho novo. Este não é: a
 * página, os planos, os direitos e o checkout já existiam e já estavam no ar.
 * O que havia era um bloqueio a mais, por cima de guardas que já faziam o
 * filtro certo — `plano.publico`, `plano.ativo` e preço maior que zero.
 *
 * Então isto é um **interruptor de emergência**, não de estreia: ausente
 * significa vendendo, e ligar `planos_fechados` tranca tudo na hora, sem
 * deploy, se algo der errado.
 */
export const CHAVE_PLANOS_FECHADOS = 'planos_fechados';

export function planosVendaveis(): boolean {
  return !interruptorLigado(CHAVE_PLANOS_FECHADOS);
}

/**
 * O par de `produtoDe`: aceita o id solto que veio do banco e devolve o
 * produto com o **preço vigente**.
 *
 * Existe para que quem tem um `pedido.produto` (string, não `ProdutoId`) não
 * precise escolher entre um cast e a tabela estática. Essa escolha é
 * exatamente o que levou a rota de pagamento a chamar `produtoDe` e mandar o
 * gateway cobrar R$ 0,00 pela Revelação.
 */
export function produtoVigenteDe(id: string) {
  return produtoVigente(ehProdutoValido(id) ? id : PRODUTO_PADRAO);
}

/**
 * Para onde vai quem acabou de receber o familiar.
 *
 * No modelo novo é a oferta de três degraus; no antigo é a revelação direto,
 * como produção faz hoje — a pessoa pagou pela leitura, então ela abre.
 */
export const CHAVE_OFERTA_FECHADA = 'oferta_fechada';

/**
 * Se a tela de oferta aparece depois da entrega.
 *
 * ── Por que saiu do interruptor do modelo ─────────────────────────────────
 *
 * Estava amarrada a `modeloNovoLigado()`, junto com o preço da Revelação. E
 * como esse interruptor precisa ficar desligado — ligá-lo zeraria o preço que
 * a campanha cobra —, a tela de venda mais importante do funil **nunca
 * apareceu para ninguém**. Ela existe, está pronta, tem teste, e estava
 * inalcançável.
 *
 * Mesmo caso de [[planosVendaveis]]: duas decisões numa chave só, e a que
 * custava caro travava a outra.
 *
 * Trava de emergência: ausente = a oferta aparece; ligar `oferta_fechada`
 * devolve todo mundo direto para a revelação, na hora, sem deploy.
 */
export function ofertaDepoisDaEntrega(): boolean {
  return !interruptorLigado(CHAVE_OFERTA_FECHADA);
}

export function destinoDepoisDaEntrega(pedidoId: string): string {
  return ofertaDepoisDaEntrega() ? `/oferta/${pedidoId}` : `/revelacao/${pedidoId}`;
}
