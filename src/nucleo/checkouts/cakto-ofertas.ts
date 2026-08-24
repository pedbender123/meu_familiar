import db from '../../lib/db';

/**
 * A oferta da Cakto, resolvida por preço.
 *
 * ── Por que este arquivo existe ───────────────────────────────────────────
 *
 * A API da Cakto não cobra valores, cobra **ofertas**: `items[0].offerId` é
 * obrigatório, `items` aceita exatamente um item, e não há campo de valor em
 * lugar nenhum do corpo. Verificado no OpenAPI deles, não deduzido.
 *
 * Aceitar isso ao pé da letra significaria cadastrar cada preço à mão no
 * painel da Cakto e colar o id num `.env` — ou seja, devolver a decisão de
 * quanto uma coisa custa para uma tela de terceiro. É o oposto da regra que o
 * projeto pagou caro para aprender: **toda decisão de preço passa por
 * `produtoVigente`/`precoVigenteCentavos`.**
 *
 * Então a oferta vira detalhe de implementação. Damos um preço em centavos,
 * isto devolve um `offerId` — criando a oferta na Cakto na primeira vez que
 * aquele preço aparecer, e reaproveitando dali em diante. Cupom novo, preço
 * novo, teste de preço: nada disso pede visita ao painel deles.
 *
 * ── O cache é no NOSSO banco, de propósito ────────────────────────────────
 *
 * Poderia ser uma busca em `GET /offers/` a cada cobrança. Não é, por dois
 * motivos: são 120 req/min por token e a cobrança já gasta duas chamadas, e
 * porque uma busca por preço que falhe em achar cria uma oferta duplicada a
 * cada venda. A tabela local é a memória do que já foi criado.
 */

export interface OfertaCakto {
  produto: string;
  preco_centavos: number;
  offer_id: string;
  nome: string | null;
  criado_em: string;
}

export function ofertaGravada(produto: string, precoCentavos: number): string | undefined {
  const linha = db
    .prepare('SELECT offer_id FROM ofertas_cakto WHERE produto = ? AND preco_centavos = ?')
    .get(produto, precoCentavos) as { offer_id: string } | undefined;
  return linha?.offer_id;
}

/**
 * `ON CONFLICT DO NOTHING`: duas cobranças simultâneas do mesmo preço podem
 * criar duas ofertas na Cakto antes de qualquer uma gravar. Perder a corrida
 * aqui custa uma oferta órfã no painel deles — barato. Estourar a chave
 * primária custaria a venda.
 */
export function gravarOferta(o: {
  produto: string;
  precoCentavos: number;
  offerId: string;
  nome?: string;
}): void {
  db.prepare(
    `INSERT INTO ofertas_cakto (produto, preco_centavos, offer_id, nome, criado_em)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(produto, preco_centavos) DO NOTHING`
  ).run(o.produto, o.precoCentavos, o.offerId, o.nome ?? null, new Date().toISOString());
}

export function listarOfertas(): OfertaCakto[] {
  return db
    .prepare('SELECT * FROM ofertas_cakto ORDER BY produto, preco_centavos')
    .all() as OfertaCakto[];
}

/** Só para os testes e para o caso de alguém apagar uma oferta no painel deles. */
export function esquecerOferta(produto: string, precoCentavos: number): void {
  db.prepare('DELETE FROM ofertas_cakto WHERE produto = ? AND preco_centavos = ?').run(
    produto,
    precoCentavos
  );
}
