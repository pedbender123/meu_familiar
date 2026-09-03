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
  /*
    O PREÇO COBRADO. É este número, direto — sem conta nenhuma por cima.

    Ele já foi um "preço cheio" do qual um cupom de 20% descia até o valor
    real, e por isso precisava ser 1225 para o cliente pagar 9,80. Toda
    mudança de preço virava uma conta reversa com arredondamento para cima, e
    errá-la cobrava um centavo a mais ou comia a margem — aconteceu, por doze
    horas, com uma venda anunciada a 9,80 saindo por 7,84.

    O riscado da vitrine agora é outra coisa, e mora em `PRECO_RISCADO_CENTAVOS`
    logo abaixo. Subir ou descer preço aqui é trocar o número e mais nada.
  */
  revelacao: 1890,
  completa: 2490,
};

/**
 * O "de" riscado na vitrine. **Decoração, e nada mais.**
 *
 * ── O que ele é, e o que ele não é ────────────────────────────────────────
 *
 * Não desconta nada, não entra em conta nenhuma e não chega perto do
 * gateway. Quem cobra lê `precoVigenteCentavos` acima. Este número existe
 * para a oferta ter uma âncora ao lado do preço, e é escolhido a olho —
 * redondo, bonito, do tamanho que o argumento pedir.
 *
 * Antes isto era o subproduto de um cupom de 20% aplicado a todo pedido: o
 * riscado saía 23,62 e 31,12, números que ninguém escolheria, e mexer no
 * preço obrigava a refazer a conta dos dois lados.
 *
 * ── O que conferir antes de mudar ─────────────────────────────────────────
 *
 * Se algum dia o riscado passar a aparecer numa tela nova, ele precisa ser um
 * preço que a loja de fato praticou em algum momento — preço de referência
 * que nunca existiu é publicidade enganosa, e o risco não é o número, é a
 * multa. Hoje ele vive só na oferta de vendas.
 */
export const PRECO_RISCADO_CENTAVOS: Partial<Record<ProdutoId, number>> = {
  revelacao: 2990,
  completa: 3990,
};

/** O riscado da assinatura, que não é `ProdutoId` — vive na tabela `planos`. */
export const PRECO_RISCADO_DA_ASSINATURA_CENTAVOS = 3990;

/** `null` quando não há âncora, ou quando ela não é maior que o preço real. */
export function riscadoDe(id: ProdutoId): number | null {
  const riscado = PRECO_RISCADO_CENTAVOS[id];
  if (!riscado) return null;
  return riscado > precoVigenteCentavos(id) ? riscado : null;
}

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

/**
 * Para onde a pessoa vai quando a entrega termina.
 *
 * Com a oferta ligada, a escada de três degraus continua vindo primeiro: é o
 * único momento de atenção total do funil, e pular ele para mostrar o app
 * seria trocar a venda pelo passeio.
 *
 * Sem ela, o destino deixou de ser a revelação pública e passou a ser a porta
 * (`/entrar/direto/[id]`): a mesma revelação, só que **dentro** da plataforma
 * e com a sessão aberta. A porta cai sozinha na página pública quando não
 * consegue provar que o navegador é o da compradora, então trocar isto aqui
 * não fecha caminho para ninguém. Ver `lib/porta-do-comprador.ts`.
 */
export function destinoDepoisDaEntrega(pedidoId: string): string {
  return ofertaDepoisDaEntrega() ? `/oferta/${pedidoId}` : `/entrar/direto/${pedidoId}`;
}

/**
 * O desconto aparece na tela de pagamento?
 *
 * ── Por que virou interruptor em vez de sumir ─────────────────────────────
 *
 * O cupom `LANCAMENTO20` é aplicado a todo pedido, então o "preço cheio"
 * riscado nunca foi cobrado de ninguém. Enquanto os preços da Wiven eram
 * cadastrados como oferta, isso era coerente com o resto; a partir do momento
 * em que os produtos passam a ser cadastrados **pelo preço praticado**, o
 * riscado vira uma afirmação falsa na tela onde a pessoa está decidindo pagar.
 *
 * Não é deletado porque desconto de verdade — Black Friday, resgate de
 * carrinho — vai querer exatamente este bloco de volta. `desconto_visivel`
 * ligado devolve.
 *
 * Ausente = escondido, que é o estado desejado agora.
 */
export const CHAVE_DESCONTO_VISIVEL = 'desconto_visivel';

export function descontoVisivel(): boolean {
  return interruptorLigado(CHAVE_DESCONTO_VISIVEL);
}
