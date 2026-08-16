import { randomBytes, randomUUID } from 'crypto';
import db from './db';
import { BONUS_DE_CONSULTAS } from './recompensa';

/**
 * Recompensa por compartilhar nos stories.
 *
 * ── A troca ───────────────────────────────────────────────────────────────
 *
 * A pessoa posta a revelação no story marcando @bruxario_ e registra o @ dela
 * aqui. Ganha 10 consultas extras ao Oráculo e acesso antecipado quando ele
 * abrir. Vale para os dois produtos.
 *
 * ── Por que a conferência é manual ────────────────────────────────────────
 *
 * O campo é um input livre num site aberto: qualquer pessoa digita qualquer @
 * e clica. Entregar a recompensa na palavra de quem digitou seria entregá-la a
 * quem não postou nada. Então `conferido` começa em 0, você vê a marcação no
 * Instagram, e libera no painel. É trabalho manual de propósito — automatizar
 * exigiria API do Instagram que não existe para este caso.
 *
 * ── A recompensa é honesta sobre o que é ──────────────────────────────────
 *
 * O Oráculo **ainda não existe**. As consultas ficam guardadas na conta, como
 * as da Completa, e o texto na tela diz isso. Prometer acesso a uma coisa que
 * não existe sem avisar seria vender fumaça em troca de divulgação.
 */

export { BONUS_DE_CONSULTAS } from './recompensa';

export interface Marcacao {
  id: string;
  pedido_id: string | null;
  email: string;
  arroba: string;
  conferido: number;
  recompensado: number;
  token: string | null;
  criado_em: string;
  conferido_em: string | null;
}

/**
 * Normaliza o @ digitado.
 *
 * Aceita `@nome`, `nome`, e a URL completa do perfil — as três formas que as
 * pessoas realmente colam. Sem isto, o mesmo perfil vira três registros e você
 * confere o mesmo story três vezes.
 */
export function normalizarArroba(bruto: string): string {
  return bruto
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 30);
}

export function registrarMarcacao(p: {
  pedidoId: string | null;
  email: string;
  arroba: string;
}): { ok: true; id: string } | { ok: false; erro: string } {
  const arroba = normalizarArroba(p.arroba);
  if (arroba.length < 2) {
    return { ok: false, erro: 'Confira o @ — parece incompleto.' };
  }

  // Um @ por pessoa: reenviar atualiza em vez de criar fila de duplicatas.
  const existente = db
    .prepare('SELECT id FROM marcacoes WHERE email = ? AND arroba = ?')
    .get(p.email.toLowerCase(), arroba) as { id: string } | undefined;

  if (existente) return { ok: true, id: existente.id };

  const id = randomUUID();
  db.prepare(
    `INSERT INTO marcacoes (id, pedido_id, email, arroba, criado_em)
     VALUES (@id, @pedidoId, @email, @arroba, @agora)`
  ).run({
    id,
    pedidoId: p.pedidoId,
    email: p.email.toLowerCase(),
    arroba,
    agora: new Date().toISOString(),
  });

  return { ok: true, id };
}

export function marcacaoDoPedido(pedidoId: string): Marcacao | undefined {
  return db
    .prepare('SELECT * FROM marcacoes WHERE pedido_id = ? LIMIT 1')
    .get(pedidoId) as Marcacao | undefined;
}

export function listarMarcacoes(): Marcacao[] {
  return db
    .prepare(
      `SELECT * FROM marcacoes
        ORDER BY conferido ASC, criado_em DESC`
    )
    .all() as Marcacao[];
}

/**
 * Confirma que a marcação existe e credita o bônus.
 *
 * O crédito é somado no PEDIDO, não numa tabela à parte, porque é lá que a
 * conta lê quantas consultas a pessoa tem. `recompensado` impede que clicar
 * duas vezes no painel dê 20 consultas.
 */
export function confirmarMarcacao(id: string): boolean {
  const m = db.prepare('SELECT * FROM marcacoes WHERE id = ?').get(id) as
    | Marcacao
    | undefined;
  if (!m || m.recompensado) return false;

  const creditar = db.transaction(() => {
    db.prepare(
      `UPDATE marcacoes SET conferido = 1, recompensado = 1, conferido_em = ?
        WHERE id = ?`
    ).run(new Date().toISOString(), id);

    if (m.pedido_id) {
      db.prepare(
        'UPDATE pedidos SET bonus_oraculo = bonus_oraculo + ? WHERE id = ?'
      ).run(BONUS_DE_CONSULTAS, m.pedido_id);
    } else {
      // Marcação sem pedido (veio pelo link de resgate): credita em todos os
      // pedidos entregues daquele e-mail, que é o que a conta lê.
      db.prepare(
        `UPDATE pedidos SET bonus_oraculo = bonus_oraculo + ?
          WHERE lower(email) = ? AND status = 'entregue'`
      ).run(BONUS_DE_CONSULTAS, m.email);
    }
  });

  creditar();
  return true;
}

/**
 * Um link de resgate para quem te marcou mas não registrou o @.
 *
 * Você vê a marcação no Instagram, gera o link aqui e manda por DM. Quem abrir
 * cai numa página que já sabe qual @ é — ela só confirma o e-mail para o bônus
 * cair na conta certa.
 *
 * O token é aleatório de 32 bytes: adivinhá-lo é inviável, e sem isso o link
 * viraria um cupom de 10 consultas que qualquer um monta na barra de endereço.
 */
export function gerarLinkDeResgate(arroba: string): string {
  const limpo = normalizarArroba(arroba);
  const token = randomBytes(24).toString('base64url');

  const existente = db
    .prepare('SELECT id FROM marcacoes WHERE arroba = ? AND pedido_id IS NULL')
    .get(limpo) as { id: string } | undefined;

  if (existente) {
    db.prepare('UPDATE marcacoes SET token = ? WHERE id = ?').run(
      token,
      existente.id
    );
  } else {
    db.prepare(
      `INSERT INTO marcacoes (id, pedido_id, email, arroba, conferido, token, criado_em)
       VALUES (?, NULL, '', ?, 1, ?, ?)`
    ).run(randomUUID(), limpo, token, new Date().toISOString());
  }

  return token;
}

export function marcacaoPorToken(token: string): Marcacao | undefined {
  if (!token || token.length < 20) return undefined;
  return db.prepare('SELECT * FROM marcacoes WHERE token = ?').get(token) as
    | Marcacao
    | undefined;
}

/** Fecha o resgate: associa o e-mail e credita. */
export function resgatarPorToken(
  token: string,
  email: string
): { ok: boolean; erro?: string } {
  const m = marcacaoPorToken(token);
  if (!m) return { ok: false, erro: 'Este link não vale mais.' };
  if (m.recompensado) return { ok: false, erro: 'Este link já foi usado.' };

  db.prepare('UPDATE marcacoes SET email = ? WHERE id = ?').run(
    email.toLowerCase(),
    m.id
  );
  const ok = confirmarMarcacao(m.id);
  // Token queimado depois do uso: link de recompensa que continua valendo é
  // link que circula em grupo de WhatsApp.
  db.prepare('UPDATE marcacoes SET token = NULL WHERE id = ?').run(m.id);

  return ok ? { ok: true } : { ok: false, erro: 'Não foi possível resgatar.' };
}
