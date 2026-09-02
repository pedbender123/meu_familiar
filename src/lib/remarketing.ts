import Database from 'better-sqlite3';
import { createHmac, randomUUID } from 'crypto';
import { BANCO } from './caminhos';
import { precoDoPedido, receitaDoPedido } from './cupons';
import type { ProdutoId } from './produtos';

const db = new Database(BANCO);

export type StatusEnvio = 'rascunho' | 'enviado' | 'falhou';

export interface Envio {
  id: string;
  email: string;
  nome: string | null;
  visitante: string | null;
  pedido_id: string | null;
  campanha_id: string | null;
  produto: string;
  desconto_percentual: number;
  cupom: string | null;
  assunto: string;
  corpo: string;
  status: StatusEnvio;
  erro: string | null;
  criado_em: string;
  enviado_em: string | null;
}

/* ── descadastro ─────────────────────────────────────────────────────────── */

/**
 * O token do link de descadastro.
 *
 * HMAC do e-mail com o segredo do servidor, e não um id no banco: assim o
 * link funciona sem criar linha nenhuma antes de alguém clicar, não expira, e
 * ninguém consegue descadastrar terceiros chutando valores.
 */
function segredo(): string {
  return (
    process.env.MP_WEBHOOK_SECRET ||
    process.env.RESEND_API_KEY ||
    'bruxario-descadastro'
  );
}

export function tokenDeDescadastro(email: string): string {
  return createHmac('sha256', segredo())
    .update(email.trim().toLowerCase())
    .digest('base64url')
    .slice(0, 32);
}

export function conferirTokenDeDescadastro(email: string, token: string): boolean {
  return tokenDeDescadastro(email) === token;
}

export function descadastrar(email: string, origem = 'link'): void {
  db.prepare(
    `INSERT INTO descadastros (email, origem, criado_em) VALUES (?, ?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).run(email.trim().toLowerCase(), origem, new Date().toISOString());
}

export function estaDescadastrado(email: string): boolean {
  return !!db
    .prepare('SELECT 1 FROM descadastros WHERE email = ?')
    .get(email.trim().toLowerCase());
}

export function listaDeDescadastrados(): Set<string> {
  return new Set(
    (db.prepare('SELECT email FROM descadastros').all() as { email: string }[]).map(
      (d) => d.email
    )
  );
}

/* ── quem existe para receber ────────────────────────────────────────────── */

export interface Contato {
  email: string;
  nome: string | null;
  visitante: string | null;
  /** O pedido mais recente dessa pessoa, se houver. */
  pedidoId: string | null;
  familiar: string | null;
  /** Cena mais alta que ela alcançou — 0 se nunca respondeu. */
  cenaMaxima: number;
  /** Produtos que ela JÁ comprou. Vazio = nunca pagou. */
  comprou: string[];
  gastouCentavos: number;
  /** Chegou a abrir o checkout sem pagar? É o grupo mais quente. */
  abriuCheckout: boolean;
  origem: string | null;
  primeiraVez: string;
  ultimaVez: string;
  descadastrado: boolean;
  /** Quantas ofertas já foram enviadas para este endereço. */
  jaRecebeu: number;
  ultimoEnvio: string | null;
}

/**
 * Todo mundo de quem temos e-mail, com o que sabemos sobre cada um.
 *
 * ── Por que junta rascunho e pedido ───────────────────────────────────────
 *
 * O mesmo e-mail pode aparecer nos dois lugares: deixou no meio do ritual
 * (rascunho) e depois terminou (pedido). Agrupar por e-mail minúsculo é o que
 * impede a mesma pessoa virar duas linhas e receber a oferta em dobro.
 */
export function contatos(filtro?: {
  de?: string;
  ate?: string;
}): Contato[] {
  const janela = filtro?.de && filtro?.ate;
  const j = { de: filtro?.de ?? '', ate: filtro?.ate ?? '' };

  const pedidos = db
    .prepare(
      `SELECT id, lower(email) email, nome, visitante, familiar, status, produto,
              desconto_percentual, bumps_centavos, bruto_centavos, origem, criado_em,
              pagamento_id, metodo_tentado
         FROM pedidos WHERE exemplo = 0
         ${janela ? 'AND criado_em >= @de AND criado_em < @ate' : ''}
        ORDER BY criado_em ASC`
    )
    .all(janela ? j : {}) as {
    id: string;
    email: string;
    nome: string;
    visitante: string | null;
    familiar: string;
    status: string;
    produto: string;
    desconto_percentual: number | null;
    bumps_centavos: number | null;
    bruto_centavos: number | null;
    origem: string | null;
    criado_em: string;
    pagamento_id: string | null;
    metodo_tentado: string | null;
  }[];

  const rascunhos = db
    .prepare(
      `SELECT lower(email) email, visitante, cena, origem, criado_em
         FROM rascunhos
        ${janela ? 'WHERE criado_em >= @de AND criado_em < @ate' : ''}
        ORDER BY criado_em ASC`
    )
    .all(janela ? j : {}) as {
    email: string;
    visitante: string | null;
    cena: number;
    origem: string | null;
    criado_em: string;
  }[];

  const cenaPorVisitante = new Map(
    (
      db
        .prepare(
          `SELECT visitante, max(valor) alto FROM marcos
            WHERE marco = 'cena' AND valor IS NOT NULL GROUP BY visitante`
        )
        .all() as { visitante: string; alto: number }[]
    ).map((c) => [c.visitante, c.alto])
  );

  const checkoutPorVisitante = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT visitante FROM marcos WHERE marco = 'checkout_aberto'`
        )
        .all() as { visitante: string }[]
    ).map((r) => r.visitante)
  );

  const enviosPorEmail = new Map(
    (
      db
        .prepare(
          `SELECT email, count(*) n, max(enviado_em) ultimo FROM remarketing
            WHERE status = 'enviado' GROUP BY email`
        )
        .all() as { email: string; n: number; ultimo: string | null }[]
    ).map((e) => [e.email, e])
  );

  const saiu = listaDeDescadastrados();
  const mapa = new Map<string, Contato>();

  const pegar = (email: string, quando: string): Contato => {
    if (!mapa.has(email)) {
      const envios = enviosPorEmail.get(email);
      mapa.set(email, {
        email,
        nome: null,
        visitante: null,
        pedidoId: null,
        familiar: null,
        cenaMaxima: 0,
        comprou: [],
        gastouCentavos: 0,
        abriuCheckout: false,
        origem: null,
        primeiraVez: quando,
        ultimaVez: quando,
        descadastrado: saiu.has(email),
        jaRecebeu: envios?.n ?? 0,
        ultimoEnvio: envios?.ultimo ?? null,
      });
    }
    const c = mapa.get(email)!;
    if (quando < c.primeiraVez) c.primeiraVez = quando;
    if (quando > c.ultimaVez) c.ultimaVez = quando;
    return c;
  };

  for (const r of rascunhos) {
    const c = pegar(r.email, r.criado_em);
    c.visitante ??= r.visitante;
    c.origem ??= r.origem;
    if (r.visitante) {
      c.cenaMaxima = Math.max(c.cenaMaxima, cenaPorVisitante.get(r.visitante) ?? r.cena);
      if (checkoutPorVisitante.has(r.visitante)) c.abriuCheckout = true;
    }
  }

  for (const p of pedidos) {
    const c = pegar(p.email, p.criado_em);
    // O pedido tem dado melhor que o rascunho: nome de verdade e familiar.
    c.nome = p.nome || c.nome;
    c.visitante = p.visitante ?? c.visitante;
    c.pedidoId = p.id;
    c.familiar = p.familiar;
    c.origem ??= p.origem;
    if (p.visitante) {
      c.cenaMaxima = Math.max(c.cenaMaxima, cenaPorVisitante.get(p.visitante) ?? 0);
      if (checkoutPorVisitante.has(p.visitante)) c.abriuCheckout = true;
    }
    /**
     * Ter `pagamento_id` prova que a pessoa chegou a criar uma cobrança —
     * ou seja, passou do checkout. Isso vale para o HISTÓRICO inteiro, ao
     * contrário do marco `checkout_aberto`, que só existe desde 07/08. Sem
     * este atalho, o recorte "quase pagou" nasceria vazio justamente para
     * as pessoas que já estão na base.
     */
    if (p.pagamento_id || p.metodo_tentado) c.abriuCheckout = true;
    if (p.status === 'entregue') {
      if (!c.comprou.includes(p.produto)) c.comprou.push(p.produto);
      c.gastouCentavos += receitaDoPedido(p);
      c.abriuCheckout = true;
    }
  }

  return [...mapa.values()].sort((a, b) => b.ultimaVez.localeCompare(a.ultimaVez));
}

/* ── envios ──────────────────────────────────────────────────────────────── */

export function criarRascunhoDeEnvio(e: {
  email: string;
  nome: string | null;
  visitante: string | null;
  pedidoId: string | null;
  campanhaId: string | null;
  produto: ProdutoId;
  descontoPercentual: number;
  cupom: string | null;
  assunto: string;
  corpo: string;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO remarketing
      (id, email, nome, visitante, pedido_id, campanha_id, produto,
       desconto_percentual, cupom, assunto, corpo, status, criado_em)
     VALUES (@id, @email, @nome, @visitante, @pedidoId, @campanhaId, @produto,
       @descontoPercentual, @cupom, @assunto, @corpo, 'rascunho', @criado_em)`
  ).run({ ...e, id, criado_em: new Date().toISOString() });
  return id;
}

export function listarEnvios(status?: StatusEnvio): Envio[] {
  if (status) {
    return db
      .prepare('SELECT * FROM remarketing WHERE status = ? ORDER BY criado_em DESC')
      .all(status) as Envio[];
  }
  return db
    .prepare('SELECT * FROM remarketing ORDER BY criado_em DESC LIMIT 300')
    .all() as Envio[];
}

export function buscarEnvio(id: string): Envio | undefined {
  return db.prepare('SELECT * FROM remarketing WHERE id = ?').get(id) as
    | Envio
    | undefined;
}

export function atualizarEnvio(id: string, campos: Partial<Envio>): void {
  const chaves = Object.keys(campos).filter((k) => k !== 'id');
  if (chaves.length === 0) return;
  const set = chaves.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE remarketing SET ${set} WHERE id = @id`).run({ ...campos, id });
}

export function apagarEnvio(id: string): void {
  db.prepare('DELETE FROM remarketing WHERE id = ?').run(id);
}
