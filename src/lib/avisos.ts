import db from './db';

/**
 * A trava de repetição dos avisos automáticos.
 *
 * ── O problema que ela resolve ────────────────────────────────────────────
 *
 * Todo cron roda mais vezes do que o aviso deve ser enviado — o de hora em
 * hora passa 24 vezes por dia, e o aviso é um por dia. Sem uma trava, cada
 * passagem manda de novo. Isso não é um bug pequeno: é o caminho mais rápido
 * para a base inteira marcar o domínio como spam, e aí os e-mails que as
 * pessoas ESPERAM (o acesso, a revelação) param de chegar junto.
 *
 * ── Por que a trava é o banco, e não um `if` ──────────────────────────────
 *
 * `registrarAviso` tenta inserir e devolve `false` se a linha já existir. A
 * unicidade é a PRIMARY KEY composta — o banco recusa, o script não precisa
 * lembrar de conferir, e duas execuções simultâneas do cron não conseguem
 * mandar dois. Conferir antes e inserir depois teria janela entre as duas
 * coisas; aqui não há janela.
 *
 * ── A ordem de uso importa ────────────────────────────────────────────────
 *
 * Registrar ANTES de enviar. Se o envio falhar, a pessoa perde um aviso —
 * chato. Se o registro falhar depois de enviar, a pessoa recebe o mesmo aviso
 * a cada passagem do cron até alguém perceber — muito pior. Na dúvida, o
 * sistema erra para o lado de mandar de menos.
 */

/** Marca o aviso. `false` = já tinha sido enviado nesta janela; não mande. */
export function registrarAviso(
  tipo: string,
  destinatario: string,
  janela: string
): boolean {
  const r = db
    .prepare(
      `INSERT INTO avisos_enviados (tipo, destinatario, janela, criado_em)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (tipo, destinatario, janela) DO NOTHING`
    )
    .run(tipo, destinatario.trim().toLowerCase(), janela, new Date().toISOString());
  return r.changes > 0;
}

/** Desfaz o registro — para o script devolver a vez quando o envio falha. */
export function desfazerAviso(tipo: string, destinatario: string, janela: string): void {
  db.prepare(
    `DELETE FROM avisos_enviados WHERE tipo = ? AND destinatario = ? AND janela = ?`
  ).run(tipo, destinatario.trim().toLowerCase(), janela);
}

export function jaAvisado(tipo: string, destinatario: string, janela: string): boolean {
  return !!db
    .prepare(
      `SELECT 1 FROM avisos_enviados WHERE tipo = ? AND destinatario = ? AND janela = ?`
    )
    .get(tipo, destinatario.trim().toLowerCase(), janela);
}

/** `YYYY-MM-DD` no fuso local — a janela diária. */
export function janelaDoDia(quando = new Date()): string {
  return `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(
    quando.getDate()
  ).padStart(2, '0')}`;
}

/** `YYYY-MM` — a janela mensal. */
export function janelaDoMes(quando = new Date()): string {
  return `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}`;
}
