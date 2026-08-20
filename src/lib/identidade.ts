import db from './db';

/**
 * O tracker próprio: quem é este navegador, de onde veio, e de quem ele é.
 *
 * ── A regra que manda aqui ────────────────────────────────────────────────
 *
 * **Nada nesta camada dispara evento.** Ela só ANOTA o que já chega ao
 * servidor em toda requisição. Quem dispara é o webhook, uma vez, com dinheiro
 * confirmado — ver `nucleo/eventos-meta.ts`.
 *
 * ── Por que anotar em vez de disparar ─────────────────────────────────────
 *
 * O navegador não sabe quantas vezes já contou. Ele tem `localStorage`, que é
 * por navegador: a mesma pessoa no app do Instagram, no Chrome do celular e
 * no computador tem três memórias diferentes e conta três vezes. O servidor
 * tem uma memória só, e é esta tabela.
 */

export interface Identidade {
  visitante: string;
  email: string | null;
  fbp: string | null;
  fbc: string | null;
  fbclid: string | null;
  url_entrada: string | null;
  referer: string | null;
  user_agent: string | null;
  ip: string | null;
  primeiro_em: string;
  ultimo_em: string;
  virou_lead_em: string | null;
}

function limpar(valor: string | null | undefined, max = 400): string | null {
  const s = valor?.toString().trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * O `_fbc` no formato que a Meta espera, montado a partir do `fbclid`.
 *
 * Quando o pixel está bloqueado, o cookie `_fbc` nunca é criado — mas o
 * `fbclid` continua vindo na URL do anúncio. O formato é público e estável:
 * `fb.1.<timestamp em ms>.<fbclid>`. Montar isso à mão recupera a atribuição
 * de quem usa bloqueador, que é justamente a fatia que o navegador perde.
 */
export function fbcDeFbclid(fbclid: string, quando = new Date()): string {
  return `fb.1.${quando.getTime()}.${fbclid}`;
}

/**
 * Anota o que este pedido HTTP trouxe. Chamado a cada visita.
 *
 * ── Primeiro toque vence, último toque atualiza ───────────────────────────
 *
 * `url_entrada`, `referer` e `fbclid` usam `COALESCE(atual, novo)`: eles
 * descrevem a CHEGADA, e a chegada aconteceu uma vez. Sobrescrever na segunda
 * página apagaria o link do anúncio e deixaria no lugar a navegação interna —
 * era assim que a origem de campanha se perdia.
 *
 * `fbp`, `fbc`, `user_agent` e `ip` usam `COALESCE(novo, atual)`: descrevem o
 * navegador AGORA, e o valor novo é o mais fresco. O `_fbp` só existe depois
 * que o pixel roda, então na primeira visita ele costuma vir nulo e aparecer
 * na segunda — sem isso, ficaria nulo para sempre.
 */
export function anotarIdentidade(dados: {
  visitante: string;
  fbp?: string | null;
  fbc?: string | null;
  fbclid?: string | null;
  urlEntrada?: string | null;
  referer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): void {
  const agora = new Date().toISOString();

  const fbclid = limpar(dados.fbclid, 255);
  // Sem cookie `_fbc` mas com `fbclid` na URL: monta o valor. Ver acima.
  const fbc = limpar(dados.fbc, 255) ?? (fbclid ? fbcDeFbclid(fbclid) : null);

  db.prepare(
    `INSERT INTO identidades
       (visitante, fbp, fbc, fbclid, url_entrada, referer, user_agent, ip,
        primeiro_em, ultimo_em)
     VALUES (@visitante, @fbp, @fbc, @fbclid, @url, @referer, @ua, @ip, @agora, @agora)
     ON CONFLICT (visitante) DO UPDATE SET
       fbp         = COALESCE(excluded.fbp, identidades.fbp),
       fbc         = COALESCE(excluded.fbc, identidades.fbc),
       fbclid      = COALESCE(identidades.fbclid, excluded.fbclid),
       url_entrada = COALESCE(identidades.url_entrada, excluded.url_entrada),
       referer     = COALESCE(identidades.referer, excluded.referer),
       user_agent  = COALESCE(excluded.user_agent, identidades.user_agent),
       ip          = COALESCE(excluded.ip, identidades.ip),
       ultimo_em   = excluded.ultimo_em`
  ).run({
    visitante: dados.visitante,
    fbp: limpar(dados.fbp, 255),
    fbc,
    fbclid,
    url: limpar(dados.urlEntrada, 900),
    referer: limpar(dados.referer, 400),
    ua: limpar(dados.userAgent, 400),
    ip: limpar(dados.ip, 60),
    agora,
  });
}

/**
 * O visitante vira **lead**: ganha dono.
 *
 * A partir daqui, tudo o que ele fez antes de dizer quem era passa a poder
 * ser atribuído — inclusive uma venda que só vai acontecer amanhã, pelo
 * webhook, quando não houver navegador nenhum por perto.
 *
 * `virou_lead_em` só é gravado na primeira vez: é a data em que ele deixou de
 * ser anônimo, e ela não acontece duas vezes.
 */
export function virouLead(visitante: string, email: string): void {
  const alvo = email.trim().toLowerCase();
  if (!alvo || !visitante) return;

  db.prepare(
    `UPDATE identidades
        SET email = @email,
            virou_lead_em = COALESCE(virou_lead_em, @agora),
            ultimo_em = @agora
      WHERE visitante = @visitante`
  ).run({ visitante, email: alvo, agora: new Date().toISOString() });
}

export function identidadeDoVisitante(visitante: string): Identidade | undefined {
  return db
    .prepare('SELECT * FROM identidades WHERE visitante = ?')
    .get(visitante) as Identidade | undefined;
}

/**
 * A melhor identidade conhecida para um e-mail.
 *
 * Uma pessoa pode ter vários visitantes (celular, computador, aba anônima). A
 * escolhida é a que tem `fbp` — sem ele a Meta não liga a venda ao anúncio, e
 * uma identidade sem `fbp` não serve para o que esta função existe. Entre as
 * que têm, a mais recente.
 */
export function identidadeDoEmail(email: string): Identidade | undefined {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return undefined;

  return db
    .prepare(
      `SELECT * FROM identidades
        WHERE email = ?
        ORDER BY (fbp IS NOT NULL) DESC, (fbc IS NOT NULL) DESC, ultimo_em DESC
        LIMIT 1`
    )
    .get(alvo) as Identidade | undefined;
}
