import db from './db';
import { enviarEventoCapi, type EventoCapi } from './capi';
import { checarEmLinha } from '../nucleo/sentinela/emLinha';

const MAX_TENTATIVAS = 8;

/** 1min, 2min, 4min, 8min... até um teto de 6h — a Meta não precisa em tempo real. */
function atrasoDaProximaTentativa(tentativas: number): number {
  const minutos = Math.min(2 ** tentativas, 360);
  return minutos * 60_000;
}

interface LinhaFila {
  id: number;
  pedido_id: string;
  evento_nome: string;
  event_id: string;
  payload_json: string;
  status: string;
  tentativas: number;
  ultimo_erro: string | null;
  criado_em: string;
  proxima_tentativa_em: string;
  enviado_em: string | null;
}

/**
 * Enfileira um evento — rápido e síncrono, sem tocar a rede. Quem confirma
 * pagamento (`webhook-pagamento.ts`) chama isto no meio do caminho crítico;
 * `processarFilaCapi()` é quem de fato fala com a Meta, num processo à parte.
 *
 * `event_id` é `UNIQUE` na tabela — enfileirar o mesmo evento duas vezes
 * (ex.: webhook reenviado, mas isso não deveria nem chegar aqui por causa da
 * idempotência de `processarNotificacaoDePagamento`) não duplica a fila.
 */
export function enfileirarEventoCapi(evento: EventoCapi & { pedidoId: string }): void {
  try {
    db.prepare(
      `INSERT INTO fila_capi (pedido_id, evento_nome, event_id, payload_json, criado_em, proxima_tentativa_em)
       VALUES (@pedido_id, @evento_nome, @event_id, @payload_json, @agora, @agora)
       ON CONFLICT(event_id) DO NOTHING`
    ).run({
      pedido_id: evento.pedidoId,
      evento_nome: evento.nome,
      event_id: evento.eventId,
      payload_json: JSON.stringify(evento),
      agora: new Date().toISOString(),
    });
  } catch (erro) {
    // Enfileirar não pode derrubar o webhook. Se isto falhar, o evento de
    // pixel se perde — mas a venda, que é o que importa, segue intacta.
    checarEmLinha('fila_capi_enfileirar_falhou', () => ({
      invariante: 'fila_capi_enfileirar_falhou',
      severidade: 'medio' as const,
      entidadeTipo: 'pedido',
      entidadeId: evento.pedidoId,
      esperado: 'evento entra na fila do CAPI sem lançar',
      encontrado: erro instanceof Error ? erro.message : String(erro),
    }));
  }
}

/**
 * Drena a fila: tenta o que está pendente e na hora (`proxima_tentativa_em`
 * já passou), com backoff exponencial. Pensado para rodar em cron a cada
 * poucos minutos (`scripts/processar-fila-capi.ts`).
 *
 * Depois de `MAX_TENTATIVAS`, marca `falhou_definitivo` e registra uma
 * anomalia `alto` — a essa altura é caso para `backfill-pixel.ts` manual, não
 * mais para retentativa automática.
 */
export async function processarFilaCapi(
  limite = 50
): Promise<{ enviados: number; falharam: number; adiados: number }> {
  const agora = new Date().toISOString();
  const pendentes = db
    .prepare(
      `SELECT * FROM fila_capi
       WHERE status = 'pendente' AND proxima_tentativa_em <= ?
       ORDER BY criado_em ASC
       LIMIT ?`
    )
    .all(agora, limite) as LinhaFila[];

  let enviados = 0;
  let falharam = 0;

  for (const linha of pendentes) {
    const evento: EventoCapi = JSON.parse(linha.payload_json);
    evento.quando = new Date(evento.quando); // JSON não preserva Date

    const resultado = await enviarEventoCapi(evento);

    if (resultado.ok) {
      db.prepare(
        `UPDATE fila_capi SET status = 'enviado', enviado_em = ? WHERE id = ?`
      ).run(new Date().toISOString(), linha.id);
      db.prepare(`UPDATE pedidos SET pixel_capi_em = ? WHERE id = ?`).run(
        new Date().toISOString(),
        linha.pedido_id
      );
      enviados++;
      continue;
    }

    const tentativas = linha.tentativas + 1;
    falharam++;

    if (tentativas >= MAX_TENTATIVAS) {
      db.prepare(
        `UPDATE fila_capi
         SET status = 'falhou_definitivo', tentativas = ?, ultimo_erro = ?
         WHERE id = ?`
      ).run(tentativas, resultado.erro ?? 'erro desconhecido', linha.id);

      checarEmLinha('fila_capi_falhou_definitivo', () => ({
        invariante: 'fila_capi_falhou_definitivo',
        severidade: 'alto' as const,
        entidadeTipo: 'pedido',
        entidadeId: linha.pedido_id,
        esperado: `evento ${linha.evento_nome} entregue ao Conversions API em até ${MAX_TENTATIVAS} tentativas`,
        encontrado: `desistiu depois de ${tentativas}: ${resultado.erro ?? 'erro desconhecido'}`,
      }));
      continue;
    }

    const proxima = new Date(Date.now() + atrasoDaProximaTentativa(tentativas)).toISOString();
    db.prepare(
      `UPDATE fila_capi
       SET tentativas = ?, ultimo_erro = ?, proxima_tentativa_em = ?
       WHERE id = ?`
    ).run(tentativas, resultado.erro ?? 'erro desconhecido', proxima, linha.id);
  }

  return { enviados, falharam, adiados: pendentes.length - enviados - falharam };
}

/** Para o painel/script: quanto está parado esperando, e o que já desistiu. */
export function resumoDaFilaCapi(): { pendentes: number; falharamDefinitivo: number } {
  const pendentes = (
    db.prepare(`SELECT COUNT(*) AS n FROM fila_capi WHERE status = 'pendente'`).get() as {
      n: number;
    }
  ).n;
  const falharamDefinitivo = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM fila_capi WHERE status = 'falhou_definitivo'`)
      .get() as { n: number }
  ).n;
  return { pendentes, falharamDefinitivo };
}
