import test, { describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido } from './db';
import { enfileirarEventoCapi, processarFilaCapi, resumoDaFilaCapi } from './fila-capi';
import { anomaliasAbertas } from '../nucleo/sentinela/registrar';

function novoPedido(): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: 'helena@exemplo.com',
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'Touro',
    signo_lua: 'Touro',
    produto: 'revelacao',
  });
  return id;
}

function linhaDaFila(eventId: string) {
  return db.prepare('SELECT * FROM fila_capi WHERE event_id = ?').get(eventId) as
    | {
        id: number;
        status: string;
        tentativas: number;
        ultimo_erro: string | null;
        proxima_tentativa_em: string;
      }
    | undefined;
}

beforeEach(() => {
  db.exec('DELETE FROM fila_capi');
  db.exec('DELETE FROM anomalias');
  db.exec('DELETE FROM pedidos');
  delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  delete process.env.META_CAPI_ACCESS_TOKEN;
});

describe('enfileirarEventoCapi', () => {
  test('enfileira sem tocar rede', () => {
    const pedidoId = novoPedido();
    enfileirarEventoCapi({
      pedidoId,
      nome: 'Purchase',
      quando: new Date(),
      eventId: `${pedidoId}:purchase`,
      valorEmReais: 9.8,
    });

    const linha = linhaDaFila(`${pedidoId}:purchase`);
    assert.ok(linha);
    assert.equal(linha!.status, 'pendente');
    assert.equal(linha!.tentativas, 0);
  });

  test('o mesmo event_id não entra duas vezes na fila (dedup por UNIQUE)', () => {
    const pedidoId = novoPedido();
    const evento = {
      pedidoId,
      nome: 'Purchase' as const,
      quando: new Date(),
      eventId: `${pedidoId}:purchase`,
      valorEmReais: 9.8,
    };
    enfileirarEventoCapi(evento);
    enfileirarEventoCapi(evento); // reenvio do webhook, mesmo event_id

    const total = db
      .prepare('SELECT COUNT(*) AS n FROM fila_capi WHERE event_id = ?')
      .get(`${pedidoId}:purchase`) as { n: number };
    assert.equal(total.n, 1);
  });
});

describe('processarFilaCapi — sem pixel configurado (ambiente de teste)', () => {
  test('sem NEXT_PUBLIC_META_PIXEL_ID, a tentativa falha sem tocar rede e a fila reagenda', async () => {
    const pedidoId = novoPedido();
    enfileirarEventoCapi({
      pedidoId,
      nome: 'Purchase',
      quando: new Date(),
      eventId: `${pedidoId}:purchase`,
    });

    const { enviados, falharam } = await processarFilaCapi();
    assert.equal(enviados, 0);
    assert.equal(falharam, 1);

    const linha = linhaDaFila(`${pedidoId}:purchase`);
    assert.equal(linha!.status, 'pendente');
    assert.equal(linha!.tentativas, 1);
    assert.match(linha!.ultimo_erro ?? '', /NEXT_PUBLIC_META_PIXEL_ID/);
    assert.ok(
      new Date(linha!.proxima_tentativa_em).getTime() > Date.now(),
      'a próxima tentativa devia ser reagendada para o futuro'
    );
  });

  test('não tenta de novo antes da hora agendada', async () => {
    const pedidoId = novoPedido();
    enfileirarEventoCapi({
      pedidoId,
      nome: 'Purchase',
      quando: new Date(),
      eventId: `${pedidoId}:purchase`,
    });

    await processarFilaCapi(); // 1ª tentativa, reagenda pro futuro
    const { falharam } = await processarFilaCapi(); // rodou de novo na hora
    assert.equal(falharam, 0, 'não devia nem tentar — ainda não chegou a hora');

    const linha = linhaDaFila(`${pedidoId}:purchase`);
    assert.equal(linha!.tentativas, 1, 'tentativas não pode subir sem passar da hora agendada');
  });

  test('depois de esgotar as tentativas, marca falhou_definitivo e a Sentinela registra alto', async () => {
    const pedidoId = novoPedido();
    enfileirarEventoCapi({
      pedidoId,
      nome: 'Purchase',
      quando: new Date(),
      eventId: `${pedidoId}:purchase`,
    });

    // Adianta a fila pra beira do limite, sem esperar 8 rodadas de verdade:
    // simula que já falhou 7 vezes e está na hora de tentar de novo agora.
    db.prepare(
      `UPDATE fila_capi SET tentativas = 7, proxima_tentativa_em = ? WHERE pedido_id = ?`
    ).run(new Date(Date.now() - 1000).toISOString(), pedidoId);

    await processarFilaCapi();

    const linha = linhaDaFila(`${pedidoId}:purchase`);
    assert.equal(linha!.status, 'falhou_definitivo');
    assert.equal(linha!.tentativas, 8);

    const abertas = anomaliasAbertas('alto');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].invariante, 'fila_capi_falhou_definitivo');
    assert.equal(abertas[0].entidadeId, pedidoId);
  });

  test('resumoDaFilaCapi conta pendentes e desistidos corretamente', async () => {
    const p1 = novoPedido();
    const p2 = novoPedido();
    enfileirarEventoCapi({ pedidoId: p1, nome: 'Purchase', quando: new Date(), eventId: `${p1}:purchase` });
    enfileirarEventoCapi({ pedidoId: p2, nome: 'Purchase', quando: new Date(), eventId: `${p2}:purchase` });

    db.prepare(`UPDATE fila_capi SET status = 'falhou_definitivo' WHERE pedido_id = ?`).run(p2);

    const resumo = resumoDaFilaCapi();
    assert.equal(resumo.pendentes, 1);
    assert.equal(resumo.falharamDefinitivo, 1);
  });
});

describe('processarFilaCapi — com a rede simulada', () => {
  test('sucesso: marca enviado e grava pixel_capi_em no pedido', async () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = 'pixel-de-teste';
    process.env.META_CAPI_ACCESS_TOKEN = 'token-de-teste';

    const chamadaFetch = mock.method(globalThis, 'fetch', async () => {
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
    });

    try {
      const pedidoId = novoPedido();
      enfileirarEventoCapi({
        pedidoId,
        nome: 'Purchase',
        quando: new Date(),
        eventId: `${pedidoId}:purchase`,
        valorEmReais: 9.8,
      });

      const { enviados } = await processarFilaCapi();
      assert.equal(enviados, 1);
      assert.equal(chamadaFetch.mock.callCount(), 1);

      const linha = linhaDaFila(`${pedidoId}:purchase`);
      assert.equal(linha!.status, 'enviado');
      assert.ok(linha!.id);

      const pedido = db.prepare('SELECT pixel_capi_em FROM pedidos WHERE id = ?').get(pedidoId) as {
        pixel_capi_em: string | null;
      };
      assert.ok(pedido.pixel_capi_em, 'devia marcar pixel_capi_em no pedido, para o backfill não reenviar');
    } finally {
      chamadaFetch.mock.restore();
      delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
      delete process.env.META_CAPI_ACCESS_TOKEN;
    }
  });
});
