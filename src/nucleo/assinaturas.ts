import { randomUUID } from 'crypto';
import db from '../lib/db';

export type StatusAssinatura = 'ativa' | 'expirada' | 'cancelada';

export interface Assinatura {
  id: string;
  conta_id: string;
  plano_id: string;
  status: StatusAssinatura;
  inicio: string;
  fim: string | null;
  renovacao_automatica: number;
  pedido_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Cria a assinatura equivalente a um pedido pago.
 *
 * Idempotente por `pedido_id` (índice único em `assinaturas`): o webhook
 * reenvia, e criar duas assinaturas do mesmo pedido inflaria a união de
 * direitos por nada (embora `unirDireitos` já seja imune a duplicata — é
 * ainda assim a coisa errada de deixar acontecer, uma linha órfã por
 * reenvio).
 */
export function criarAssinatura(dados: {
  contaId: string;
  planoId: string;
  pedidoId?: string | null;
  inicio?: Date;
  fim?: string | null;
}): Assinatura | null {
  const agora = new Date().toISOString();
  const id = randomUUID();

  const info = db
    .prepare(
      `INSERT INTO assinaturas
         (id, conta_id, plano_id, status, inicio, fim, renovacao_automatica,
          pedido_id, criado_em, atualizado_em)
       VALUES (@id, @conta_id, @plano_id, 'ativa', @inicio, @fim, 0,
          @pedido_id, @agora, @agora)
       ON CONFLICT(pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING`
    )
    .run({
      id,
      conta_id: dados.contaId,
      plano_id: dados.planoId,
      inicio: (dados.inicio ?? new Date()).toISOString(),
      fim: dados.fim ?? null,
      pedido_id: dados.pedidoId ?? null,
      agora,
    });

  if (info.changes === 0) return buscarAssinaturaDoPedido(dados.pedidoId ?? '') ?? null;
  return buscarAssinatura(id) ?? null;
}

export function buscarAssinatura(id: string): Assinatura | undefined {
  return db.prepare('SELECT * FROM assinaturas WHERE id = ?').get(id) as Assinatura | undefined;
}

export function buscarAssinaturaDoPedido(pedidoId: string): Assinatura | undefined {
  if (!pedidoId) return undefined;
  return db.prepare('SELECT * FROM assinaturas WHERE pedido_id = ?').get(pedidoId) as
    | Assinatura
    | undefined;
}

/**
 * Ativas de verdade agora: `status = 'ativa'` E (`fim` nulo OU no futuro).
 * `status` guarda a intenção (cancelou?); a data é o que decide na prática —
 * uma assinatura "ativa" cujo prazo passou não deveria continuar liberando
 * nada só porque ninguém rodou o job que muda o status pra 'expirada'.
 */
export function assinaturasAtivasDaConta(contaId: string, agora = new Date()): Assinatura[] {
  return db
    .prepare(
      `SELECT * FROM assinaturas
       WHERE conta_id = ? AND status = 'ativa' AND (fim IS NULL OR fim > ?)`
    )
    .all(contaId, agora.toISOString()) as Assinatura[];
}

export function todasAsAssinaturasDaConta(contaId: string): Assinatura[] {
  return db
    .prepare('SELECT * FROM assinaturas WHERE conta_id = ? ORDER BY criado_em DESC')
    .all(contaId) as Assinatura[];
}
