import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import db from './db';

/**
 * Link mágico e sessão, para a conta do Bruxário e para o painel.
 *
 * ── Por que link mágico e não senha ───────────────────────────────────────
 *
 * Senha é um segredo que a pessoa precisa guardar, que vaza em outro site e é
 * reusada aqui, e que obriga a construir "esqueci minha senha" — que no fim é
 * um link mágico com passos a mais. Sem senha não há o que vazar.
 *
 * ── O que é guardado no banco ─────────────────────────────────────────────
 *
 * **Só o hash.** O token que vai no e-mail nunca é gravado. Se o banco
 * vazar, os hashes não servem para entrar — é a mesma razão de não guardar
 * senha em texto puro, e vale igual para token de sessão.
 *
 * ── Regras que fecham os buracos conhecidos ───────────────────────────────
 *
 *  - **Uso único.** O link morre ao ser usado. Sem isso, um e-mail encaminhado
 *    ou um histórico de navegador vira acesso permanente.
 *  - **Validade curta** (20 min). Janela pequena para um link que pode ficar
 *    parado numa caixa de entrada.
 *  - **Comparação em tempo constante.** Evita descobrir o token byte a byte
 *    medindo o tempo de resposta.
 *  - **Resposta idêntica exista ou não a conta.** Quem pede link para um
 *    e-mail que não existe recebe a mesma tela de quem existe — senão a tela
 *    de login vira uma consulta de "essa pessoa é cliente?".
 */

export const VALIDADE_DO_LINK_MIN = 20;
const VALIDADE_DA_SESSAO_DIAS = 30;
/** O painel expira mais rápido: é acesso a dado de todo mundo. */
const VALIDADE_DA_SESSAO_ADMIN_HORAS = 12;

export type TipoDeAcesso = 'conta' | 'admin';

export const COOKIE_DA_SESSAO = 'bruxario_sessao';

db.exec(`
  CREATE TABLE IF NOT EXISTS contas (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    criado_em TEXT NOT NULL,
    ultimo_acesso_em TEXT,
    -- Mapa natal (ver src/nucleo/perfil-astral.ts). Banco que já existia
    -- recebe estas colunas pela migração 011; banco novo nasce com elas
    -- aqui, porque esta tabela é criada DEPOIS das migrações rodarem e a
    -- 011 não teria o que alterar.
    nascimento_data TEXT,
    nascimento_hora TEXT,
    nascimento_cidade TEXT,
    nascimento_lat REAL,
    nascimento_lon REAL,
    nascimento_preenchido_em TEXT,
    nascimento_pedido_em TEXT,
    -- 1 = a pessoa não sabia a hora e usamos meio-dia (ver migração 013)
    nascimento_hora_aproximada INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tokens_magicos (
    hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    tipo TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    usado_em TEXT,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    tipo TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tokens_expira ON tokens_magicos(expira_em);
  CREATE INDEX IF NOT EXISTS idx_sessoes_expira ON sessoes(expira_em);
`);

function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Compara em tempo constante, tolerando tamanhos diferentes. */
function iguais(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function agora(): Date {
  return new Date();
}

function emMinutos(min: number): string {
  return new Date(Date.now() + min * 60_000).toISOString();
}

/* ── quem é o dono do painel ───────────────────────────────────────────── */

/**
 * O painel não tem cadastro: tem **um endereço**, definido no ambiente.
 *
 * É o que torna a tela de acesso inatacável por construção — não há campo de
 * e-mail para tentar outro endereço, não há usuário para enumerar, e não há
 * senha para forçar. Quem não recebe e-mail nessa caixa não entra.
 */
export function emailDoAdmin(): string | null {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return email || null;
}

export function ehAdmin(email: string): boolean {
  const dono = emailDoAdmin();
  return !!dono && dono === email.trim().toLowerCase();
}

/* ── a equipe do painel ────────────────────────────────────────────────── */

export interface AcessoDoPainel {
  email: string;
  papel: 'leitor';
  nota: string | null;
  criado_por: string;
  criado_em: string;
  ultimo_acesso_em: string | null;
}

/**
 * **Ver** o painel: o dono, ou quem ele colocou na lista.
 *
 * O dono nunca está na tabela — ele é `ADMIN_EMAIL`. Ver a nota da migração
 * `021`: a garantia de que o endereço do dono não sai da lista é não existir
 * linha para apagar, não uma trava contra apagá-la.
 */
export function podeVerPainel(email: string): boolean {
  const alvo = email.trim().toLowerCase();
  if (!alvo) return false;
  if (ehAdmin(alvo)) return true;
  return !!db
    .prepare('SELECT 1 FROM painel_acessos WHERE email = ?')
    .get(alvo);
}

/**
 * **Mexer** em qualquer coisa pelo painel: só o dono.
 *
 * Não é um papel guardado no banco, e isso é o ponto. `painel_acessos.papel`
 * aceita só `'leitor'` por CHECK, então nem um UPDATE malicioso na tabela
 * promove ninguém — o poder de editar é ser o endereço do ambiente, e mais
 * nada.
 */
export function podeEditarPainel(email: string): boolean {
  return ehAdmin(email);
}

export function listarAcessosDoPainel(): AcessoDoPainel[] {
  return db
    .prepare('SELECT * FROM painel_acessos ORDER BY criado_em')
    .all() as AcessoDoPainel[];
}

/**
 * Põe alguém na lista. Devolve `false` se o e-mail for inválido ou for o
 * próprio dono — ele já vê tudo, e criar a linha dele daria a impressão
 * errada de que removê-la tiraria o acesso.
 */
export function adicionarAcessoAoPainel(
  email: string,
  porQuem: string,
  nota?: string
): boolean {
  const alvo = email.trim().toLowerCase();
  if (!alvo || !alvo.includes('@')) return false;
  if (ehAdmin(alvo)) return false;

  db.prepare(
    `INSERT INTO painel_acessos (email, papel, nota, criado_por, criado_em)
     VALUES (?, 'leitor', ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET nota = excluded.nota`
  ).run(alvo, nota?.trim() || null, porQuem.trim().toLowerCase(), new Date().toISOString());
  return true;
}

/**
 * Tira alguém da lista — e derruba a sessão aberta na mesma hora.
 *
 * Sem apagar as sessões, quem foi removido continuaria dentro por até
 * `VALIDADE_DA_SESSAO_ADMIN_HORAS`. `lerSessao` também confere a lista a cada
 * requisição, então isto é cinto e suspensório; os dois são baratos e o custo
 * de errar aqui é alguém demitido lendo o faturamento.
 */
export function removerAcessoAoPainel(email: string): void {
  const alvo = email.trim().toLowerCase();
  if (ehAdmin(alvo)) return;
  db.prepare('DELETE FROM painel_acessos WHERE email = ?').run(alvo);
  db.prepare("DELETE FROM sessoes WHERE tipo = 'admin' AND email = ?").run(alvo);
}

export function marcarAcessoDoPainel(email: string): void {
  db.prepare('UPDATE painel_acessos SET ultimo_acesso_em = ? WHERE email = ?').run(
    new Date().toISOString(),
    email.trim().toLowerCase()
  );
}

/* ── contas ────────────────────────────────────────────────────────────── */

export interface Conta {
  id: string;
  email: string;
  criado_em: string;
  ultimo_acesso_em: string | null;
}

export function buscarConta(email: string): Conta | undefined {
  return db
    .prepare('SELECT * FROM contas WHERE email = ?')
    .get(email.trim().toLowerCase()) as Conta | undefined;
}

/**
 * Cria a conta se ainda não existir. Idempotente de propósito: é chamada
 * quando alguém compra a Completa, e o webhook pode repetir.
 */
export function garantirConta(email: string): Conta {
  const normalizado = email.trim().toLowerCase();
  const existente = buscarConta(normalizado);
  if (existente) return existente;

  const conta: Conta = {
    id: randomBytes(16).toString('hex'),
    email: normalizado,
    criado_em: agora().toISOString(),
    ultimo_acesso_em: null,
  };
  db.prepare(
    'INSERT INTO contas (id, email, criado_em, ultimo_acesso_em) VALUES (?, ?, ?, NULL)'
  ).run(conta.id, conta.email, conta.criado_em);
  return conta;
}

/* ── o link mágico ─────────────────────────────────────────────────────── */

/**
 * Gera um token de uso único. Devolve o token **em claro** — é a única vez em
 * que ele existe fora do e-mail; o banco só vê o hash.
 *
 * `minutosDeValidade` é opcional e existe para o caso específico do convite:
 * um e-mail que anuncia uma novidade não é lido em vinte minutos como um
 * "quero entrar agora" é — ele é aberto no fim de semana, no ônibus, dias
 * depois. Link curto ali significa a pessoa clicar, ver "expirado" e nunca
 * mais voltar. **O uso único continua valendo em todos os casos**: prazo
 * longo com uso único é bem diferente de link permanente.
 */
export function criarTokenMagico(
  email: string,
  tipo: TipoDeAcesso,
  minutosDeValidade = VALIDADE_DO_LINK_MIN
): string {
  const token = randomBytes(32).toString('base64url');
  const normalizado = email.trim().toLowerCase();

  db.prepare(
    `INSERT INTO tokens_magicos (hash, email, tipo, expira_em, usado_em, criado_em)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(
    hashDe(token),
    normalizado,
    tipo,
    emMinutos(minutosDeValidade),
    agora().toISOString()
  );

  limparExpirados();
  return token;
}

/** Sete dias, em minutos — o prazo do convite da mudança de planos. */
export const VALIDADE_DO_CONVITE_MIN = 7 * 24 * 60;

export interface TokenValidado {
  email: string;
  tipo: TipoDeAcesso;
}

/**
 * Consome o token: valida e marca como usado na mesma transação.
 *
 * A transação importa — dois cliques simultâneos no mesmo link não podem
 * abrir duas sessões.
 */
export function consumirTokenMagico(token: string): TokenValidado | null {
  if (!token) return null;

  const consumir = db.transaction((hash: string) => {
    const linha = db
      .prepare('SELECT * FROM tokens_magicos WHERE hash = ?')
      .get(hash) as
      | { hash: string; email: string; tipo: TipoDeAcesso; expira_em: string; usado_em: string | null }
      | undefined;

    if (!linha) return null;
    if (linha.usado_em) return null;
    if (new Date(linha.expira_em).getTime() <= Date.now()) return null;
    // O hash vem de uma busca por igualdade, mas a comparação explícita
    // mantém a intenção clara e protege se a busca virar algo mais frouxo.
    if (!iguais(linha.hash, hash)) return null;

    db.prepare('UPDATE tokens_magicos SET usado_em = ? WHERE hash = ?').run(
      agora().toISOString(),
      hash
    );
    return { email: linha.email, tipo: linha.tipo };
  });

  return consumir(hashDe(token));
}

/* ── sessão ────────────────────────────────────────────────────────────── */

export interface Sessao {
  email: string;
  tipo: TipoDeAcesso;
}

/** Cria a sessão e devolve o token do cookie (em claro, só aqui). */
export function abrirSessao(email: string, tipo: TipoDeAcesso): {
  token: string;
  expiraEm: Date;
} {
  const token = randomBytes(32).toString('base64url');
  const expiraEm =
    tipo === 'admin'
      ? new Date(Date.now() + VALIDADE_DA_SESSAO_ADMIN_HORAS * 3_600_000)
      : new Date(Date.now() + VALIDADE_DA_SESSAO_DIAS * 86_400_000);

  db.prepare(
    `INSERT INTO sessoes (hash, email, tipo, expira_em, criado_em) VALUES (?, ?, ?, ?, ?)`
  ).run(
    hashDe(token),
    email.trim().toLowerCase(),
    tipo,
    expiraEm.toISOString(),
    agora().toISOString()
  );

  if (tipo === 'conta') {
    db.prepare('UPDATE contas SET ultimo_acesso_em = ? WHERE email = ?').run(
      agora().toISOString(),
      email.trim().toLowerCase()
    );
  } else {
    // Quem da equipe entrou, e quando. É o dado que responde "esse acesso
    // ainda faz sentido?" seis meses depois de ter sido dado.
    marcarAcessoDoPainel(email);
  }

  return { token, expiraEm };
}

export function lerSessao(token: string | undefined): Sessao | null {
  if (!token) return null;

  const linha = db
    .prepare('SELECT email, tipo, expira_em FROM sessoes WHERE hash = ?')
    .get(hashDe(token)) as
    | { email: string; tipo: TipoDeAcesso; expira_em: string }
    | undefined;

  if (!linha) return null;
  if (new Date(linha.expira_em).getTime() <= Date.now()) return null;

  /**
   * Confere a lista a CADA requisição, não só no login.
   *
   * É o que faz "tirar da equipe" valer imediatamente: sem isto, quem fosse
   * removido continuaria dentro até a sessão vencer sozinha, que hoje são
   * horas. Também cobre a troca de `ADMIN_EMAIL` no ambiente — sessão aberta
   * com o endereço antigo para de valer na hora.
   */
  if (linha.tipo === 'admin' && !podeVerPainel(linha.email)) return null;

  return { email: linha.email, tipo: linha.tipo };
}

export function fecharSessao(token: string | undefined): void {
  if (!token) return;
  db.prepare('DELETE FROM sessoes WHERE hash = ?').run(hashDe(token));
}

/** Higiene: some com token e sessão vencidos. Barato, roda a cada novo link. */
function limparExpirados(): void {
  const agoraIso = agora().toISOString();
  db.prepare('DELETE FROM tokens_magicos WHERE expira_em < ?').run(agoraIso);
  db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agoraIso);
}
