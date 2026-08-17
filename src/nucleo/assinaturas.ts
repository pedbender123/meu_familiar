import { randomUUID } from 'crypto';
import db from '../lib/db';

const UM_DIA_MS = 86_400_000;

/**
 * A data em que a assinatura vence, pelo prazo declarado no plano.
 *
 * Plano inexistente devolve `null` (pra sempre) de propósito: entre trancar
 * alguém que pagou por causa de um `plano_id` escrito errado e deixar acesso
 * demais, o erro barato é o segundo — e a Sentinela pega o plano órfão.
 */
function fimPeloPlano(planoId: string, inicio: Date): string | null {
  const plano = db
    .prepare('SELECT duracao_dias FROM planos WHERE id = ?')
    .get(planoId) as { duracao_dias: number | null } | undefined;

  if (!plano?.duracao_dias) return null;
  return new Date(inicio.getTime() + plano.duracao_dias * UM_DIA_MS).toISOString();
}

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
 *
 * **`fim` sai do plano quando não vem escrito.** `duracao_dias` do plano é
 * quanto ele dura; quem chama não deveria ter que recalcular isso toda vez —
 * e cada lugar que recalculasse seria um lugar a mais pra errar a conta e
 * dar (ou tirar) tempo de alguém. `duracao_dias: null` continua significando
 * "pra sempre", que é o caso dos avulsos antigos.
 *
 * Passar `fim` explicitamente vence o plano: é o que a migração de cortesia
 * usa pra dar 30 dias de um plano anual, por exemplo.
 */
export function criarAssinatura(dados: {
  contaId: string;
  planoId: string;
  pedidoId?: string | null;
  inicio?: Date;
  /** Ausente = calcula do `duracao_dias` do plano. `null` = força "pra sempre". */
  fim?: string | null;
}): Assinatura | null {
  const agora = new Date().toISOString();
  const id = randomUUID();
  const inicio = dados.inicio ?? new Date();

  const fim =
    dados.fim !== undefined ? dados.fim : fimPeloPlano(dados.planoId, inicio);

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
      inicio: inicio.toISOString(),
      fim,
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
