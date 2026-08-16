import db from '../../lib/db';
import type { Anomalia, AnomaliaRegistrada, Severidade } from './tipos';

interface LinhaAnomalia {
  id: number;
  ocorrido_em: string;
  invariante: string;
  severidade: Severidade;
  entidade_tipo: string;
  entidade_id: string;
  esperado: string;
  encontrado: string;
  contexto_json: string | null;
  resolvido_em: string | null;
  resolucao: string | null;
  falso_positivo: number;
}

function paraForaDoBanco(l: LinhaAnomalia): AnomaliaRegistrada {
  return {
    id: l.id,
    ocorridoEm: l.ocorrido_em,
    invariante: l.invariante,
    severidade: l.severidade,
    entidadeTipo: l.entidade_tipo,
    entidadeId: l.entidade_id,
    esperado: l.esperado,
    encontrado: l.encontrado,
    contexto: l.contexto_json ? JSON.parse(l.contexto_json) : undefined,
    resolvidoEm: l.resolvido_em,
    resolucao: l.resolucao,
    falsoPositivo: l.falso_positivo === 1,
  };
}

/**
 * Não registra de novo o EXATO mesmo achado (mesma invariante, mesma
 * entidade, mesmo `esperado`/`encontrado`) — aberto ou já resolvido.
 *
 * Sem isto, rodar `npm run sentinela` em cron reabriria a mesma anomalia a
 * cada execução para um registro legado que nunca vai mudar, inundando a
 * tabela e treinando quem olha o painel a ignorar alerta crítico — o efeito
 * contrário ao que a Sentinela existe para evitar (docs/reestruturacao.md
 * §5 e §11: "Sentinela barulhenta é Sentinela ignorada"). Um achado com
 * `esperado`/`encontrado` DIFERENTE do último para a mesma entidade ainda
 * passa — é uma ocorrência nova de verdade, não repetição.
 */
function jaRegistrado(a: Anomalia): boolean {
  const existente = db
    .prepare(
      `SELECT 1 FROM anomalias
       WHERE invariante = ? AND entidade_tipo = ? AND entidade_id = ?
         AND esperado = ? AND encontrado = ?
       LIMIT 1`
    )
    .get(a.invariante, a.entidadeTipo, a.entidadeId, a.esperado, a.encontrado);
  return !!existente;
}

/** Devolve o id da linha (nova ou já existente) — `null` se foi deduplicada. */
export function registrarAnomalia(a: Anomalia): number | null {
  if (jaRegistrado(a)) return null;

  const info = db
    .prepare(
      `INSERT INTO anomalias
         (ocorrido_em, invariante, severidade, entidade_tipo, entidade_id,
          esperado, encontrado, contexto_json)
       VALUES (@ocorrido_em, @invariante, @severidade, @entidade_tipo, @entidade_id,
          @esperado, @encontrado, @contexto_json)`
    )
    .run({
      ocorrido_em: new Date().toISOString(),
      invariante: a.invariante,
      severidade: a.severidade,
      entidade_tipo: a.entidadeTipo,
      entidade_id: a.entidadeId,
      esperado: a.esperado,
      encontrado: a.encontrado,
      contexto_json: a.contexto ? JSON.stringify(a.contexto) : null,
    });
  return Number(info.lastInsertRowid);
}

export function anomaliasAbertas(severidade?: Severidade): AnomaliaRegistrada[] {
  const linhas = severidade
    ? (db
        .prepare(
          `SELECT * FROM anomalias WHERE resolvido_em IS NULL AND severidade = ?
           ORDER BY ocorrido_em DESC`
        )
        .all(severidade) as LinhaAnomalia[])
    : (db
        .prepare(`SELECT * FROM anomalias WHERE resolvido_em IS NULL ORDER BY ocorrido_em DESC`)
        .all() as LinhaAnomalia[]);
  return linhas.map(paraForaDoBanco);
}

export function anomaliasRecentes(limite = 100): AnomaliaRegistrada[] {
  return (
    db.prepare(`SELECT * FROM anomalias ORDER BY ocorrido_em DESC LIMIT ?`).all(limite) as LinhaAnomalia[]
  ).map(paraForaDoBanco);
}

/**
 * Marca como resolvida. `falsoPositivo=true` alimenta o ajuste das regras —
 * invariante que grita à toa é invariante que vai ser ignorada, e invariante
 * ignorada é pior que invariante inexistente (docs/reestruturacao.md §5).
 */
export function resolverAnomalia(id: number, resolucao: string, falsoPositivo = false): void {
  db.prepare(
    `UPDATE anomalias SET resolvido_em = ?, resolucao = ?, falso_positivo = ? WHERE id = ?`
  ).run(new Date().toISOString(), resolucao, falsoPositivo ? 1 : 0, id);
}

/** Para o resumo diário: quantas abertas, por severidade, agrupadas por invariante. */
export function contagemPorInvariante(): { invariante: string; severidade: Severidade; n: number }[] {
  return db
    .prepare(
      `SELECT invariante, severidade, COUNT(*) AS n
       FROM anomalias WHERE resolvido_em IS NULL
       GROUP BY invariante, severidade
       ORDER BY n DESC`
    )
    .all() as { invariante: string; severidade: Severidade; n: number }[];
}
