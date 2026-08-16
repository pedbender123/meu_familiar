import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido, buscarPedido, atualizarPedido } from './db';
import { processarPedido } from './processar';
import { processarNotificacaoDePagamento } from './webhook-pagamento';
import type { ResultadoPagamento } from '../nucleo/checkouts/mercadopago';
import type { ProdutoId } from './produtos';
import { anomaliasAbertas } from '../nucleo/sentinela/registrar';

/**
 * O caminho crítico de ponta a ponta (docs/reestruturacao.md, Fase 0):
 * pedido → pagamento confirmado → webhook → entrega → evento.
 *
 * ── O que fica de fora, de propósito ──────────────────────────────────────
 *
 * A GERAÇÃO em si (Gemini, PDF, imagens, narração) nunca roda aqui — exigiria
 * rede, chave de API e minutos, e um teste que depende de um serviço externo
 * não é mais um teste, é uma esperança. O que ESTE arquivo garante é a parte
 * que quebrar custa mais caro em silêncio: os estados do pedido, a
 * idempotência do webhook (o MP reenvia — sempre), e o rastro de eventos.
 * `processarPedido` é exercitado de verdade só onde o guard dele barra ANTES
 * de qualquer chamada externa (pedido já terminal) — o resto é escopo de
 * teste manual (ver a seção "Verificação" do documento).
 *
 * Roda contra banco isolado (BRUXARIO_DIR_DADOS, setado por `npm test`) e sem
 * RESEND_API_KEY — o que faz `email.ts` imprimir no console em vez de tentar
 * rede real, então o trecho de `aposPagamento` que manda e-mail de confirmação
 * é seguro de chamar aqui.
 */

function novoPedido(sobrescreve: Partial<{
  produto: ProdutoId;
  email: string;
}> = {}): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: 'helena@exemplo.com',
    respostas_json: JSON.stringify({ dataNascimento: '1994-05-10', quiz: {} }),
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'Touro',
    signo_lua: 'Touro',
    produto: 'revelacao',
    ...sobrescreve,
  });
  return id;
}

function resultadoAprovado(
  sobrescreve: Partial<ResultadoPagamento> = {}
): ResultadoPagamento {
  return {
    idExterno: `mp-${randomUUID()}`,
    status: 'approved',
    statusDetalhe: 'accredited',
    referenciaExterna: null,
    brutoCentavos: 980,
    taxaCentavos: 39,
    liquidoCentavos: 941,
    metodo: 'pix',
    ...sobrescreve,
  };
}

function eventosDoPedido(pedidoId: string): string[] {
  return (
    db
      .prepare('SELECT tipo FROM eventos WHERE pedido_id = ? ORDER BY id ASC')
      .all(pedidoId) as { tipo: string }[]
  ).map((e) => e.tipo);
}

function eventosSemPedido(tipo: string): number {
  return (
    db
      .prepare('SELECT COUNT(*) AS n FROM eventos WHERE pedido_id IS NULL AND tipo = ?')
      .get(tipo) as { n: number }
  ).n;
}

beforeEach(() => {
  db.exec('DELETE FROM eventos');
  db.exec('DELETE FROM pedidos');
  db.exec('DELETE FROM anomalias');
});

describe('caminho crítico: pedido → pagamento → webhook → entrega → evento', () => {
  test('a jornada completa deixa o pedido pago, com expiração e rastro de eventos corretos', async () => {
    const pedidoId = novoPedido();
    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');

    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });
    const { desfecho, entrega } = await processarNotificacaoDePagamento(resultado);
    assert.equal(desfecho, 'processado');
    await entrega; // em produção é fogo-e-esquece; o teste espera para ser determinístico

    const pedido = buscarPedido(pedidoId)!;
    assert.equal(pedido.status, 'pago');
    assert.equal(pedido.pagamento_id, resultado.idExterno);
    assert.equal(pedido.bruto_centavos, 980);
    assert.equal(pedido.metodo_pagamento, 'pix');
    assert.ok(pedido.pago_em);
    assert.ok(pedido.expira_em, 'Revelação tem expiração de link público');

    const dias =
      (new Date(pedido.expira_em!).getTime() - new Date(pedido.pago_em!).getTime()) /
      86_400_000;
    assert.ok(Math.abs(dias - 7) < 0.01, `esperava 7 dias de expiração, achou ${dias}`);

    assert.deepEqual(eventosDoPedido(pedidoId), [
      'pagamento_confirmado',
      'ritual_pendente_apos_pagamento',
    ]);
  });

  test('produto Completa não expira o link público', async () => {
    const pedidoId = novoPedido({ produto: 'completa' });
    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });
    const { entrega } = await processarNotificacaoDePagamento(resultado);
    await entrega;

    assert.equal(buscarPedido(pedidoId)?.expira_em, null);
  });

  test('idempotência: um segundo webhook para o MESMO pagamento não reprocessa', async () => {
    const pedidoId = novoPedido();
    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });

    const primeira = await processarNotificacaoDePagamento(resultado);
    await primeira.entrega;
    assert.equal(primeira.desfecho, 'processado');

    const pagoEmAntes = buscarPedido(pedidoId)!.pago_em;

    // O Mercado Pago reenvia a MESMA notificação — comportamento documentado
    // e esperado, não uma falha de rede.
    const segunda = await processarNotificacaoDePagamento(resultado);
    assert.equal(segunda.desfecho, 'ja_processado');
    assert.equal(segunda.entrega, undefined, 'não deve disparar a entrega de novo');

    const pedidoDepois = buscarPedido(pedidoId)!;
    assert.equal(pedidoDepois.pago_em, pagoEmAntes, 'pago_em não pode mudar num reenvio');
    assert.deepEqual(
      eventosDoPedido(pedidoId),
      ['pagamento_confirmado', 'ritual_pendente_apos_pagamento'],
      'o segundo webhook não pode duplicar o rastro de eventos'
    );
  });

  test('reenvio sem referência externa ainda acha o pedido pelo pagamento_id já salvo', async () => {
    const pedidoId = novoPedido();
    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });
    const { entrega } = await processarNotificacaoDePagamento(resultado);
    await entrega;

    // O MP reenvia sem repetir o external_reference no corpo — só o id do
    // pagamento, que já ficou salvo no pedido na primeira passada.
    const reenvio = { ...resultado, referenciaExterna: null };
    const segunda = await processarNotificacaoDePagamento(reenvio);
    assert.equal(
      segunda.desfecho,
      'ja_processado',
      'devia achar o pedido pelo pagamento_id, não voltar como "sem_pedido"'
    );
  });

  test('status que não libera acesso (pending, rejected) não toca o pedido', async () => {
    const pedidoId = novoPedido();
    const resultado = resultadoAprovado({ referenciaExterna: pedidoId, status: 'pending' });

    const { desfecho, entrega } = await processarNotificacaoDePagamento(resultado);
    assert.equal(desfecho, 'nao_libera_acesso');
    assert.equal(entrega, undefined);
    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');
    assert.equal(eventosSemPedido('pagamento_pending'), 1);
  });

  test('pagamento aprovado sem pedido correspondente não quebra e não inventa pedido', async () => {
    const resultado = resultadoAprovado({ referenciaExterna: 'pedido-que-nunca-existiu' });
    const { desfecho, entrega } = await processarNotificacaoDePagamento(resultado);
    assert.equal(desfecho, 'sem_pedido');
    assert.equal(entrega, undefined);
  });

  test('pedido marcado como amostra (exemplo) não dispara e-mail de confirmação', async () => {
    const pedidoId = novoPedido();
    atualizarPedido(pedidoId, { exemplo: 1 });

    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });
    const { entrega } = await processarNotificacaoDePagamento(resultado);
    await entrega;

    assert.deepEqual(eventosDoPedido(pedidoId), [
      'pagamento_confirmado',
      'ritual_pendente_apos_pagamento',
    ]);
  });

  test('a Sentinela acusa em linha um pagamento confirmado com valor que não bate com o produto', async () => {
    const pedidoId = novoPedido({ produto: 'completa' }); // 1890 centavos de tabela
    const resultado = resultadoAprovado({
      referenciaExterna: pedidoId,
      brutoCentavos: 100, // muito abaixo do devido, sem cupom que justifique
    });
    const { entrega } = await processarNotificacaoDePagamento(resultado);
    await entrega;

    const abertas = anomaliasAbertas('critico');
    assert.equal(abertas.length, 1);
    assert.equal(abertas[0].invariante, 'valor_cobrado_bate_com_produto_e_cupom');
    assert.equal(abertas[0].entidadeId, pedidoId);
  });

  test('pedido sem e-mail registra o evento e não tenta enviar nada', async () => {
    const pedidoId = novoPedido({ email: '' });
    const resultado = resultadoAprovado({ referenciaExterna: pedidoId });
    const { entrega } = await processarNotificacaoDePagamento(resultado);
    await entrega;

    assert.deepEqual(eventosDoPedido(pedidoId), [
      'pagamento_confirmado',
      'ritual_pendente_apos_pagamento',
      'email_pendente_apos_pagamento',
    ]);
  });
});

describe('processarPedido: o guard de idempotência barra ANTES de qualquer chamada externa', () => {
  test('pedido inexistente não lança', async () => {
    await assert.doesNotReject(() => processarPedido('id-que-nao-existe'));
  });

  test('pedido já entregue não é reprocessado — nenhum evento novo, nenhuma tentativa de gerar de novo', async () => {
    const pedidoId = novoPedido();
    atualizarPedido(pedidoId, { status: 'entregue' });

    await processarPedido(pedidoId);

    assert.equal(buscarPedido(pedidoId)?.status, 'entregue', 'status não pode regredir nem mudar');
    assert.deepEqual(eventosDoPedido(pedidoId), [], 'guard barra antes de registrar qualquer evento');
  });

  test('pedido ainda aguardando pagamento não é processado por engano', async () => {
    const pedidoId = novoPedido();
    // status já nasce 'aguardando_pagamento' — não passou pelo webhook ainda.
    await processarPedido(pedidoId);

    assert.equal(buscarPedido(pedidoId)?.status, 'aguardando_pagamento');
    assert.deepEqual(eventosDoPedido(pedidoId), []);
  });
});
