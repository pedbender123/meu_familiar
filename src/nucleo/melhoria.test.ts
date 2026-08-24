import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db, { criarPedido, buscarPedido, atualizarPedido } from '../lib/db';
import { podeMelhorar, buscarPedidoPorMelhoria, anotarPagamentoDaMelhoria } from './melhoria';

/**
 * A melhoria é uma SEGUNDA cobrança sobre um pedido já entregue. É o único
 * lugar do sistema onde isso acontece, e é onde as travas de idempotência do
 * funil normal não valem — por isso cada regra tem teste próprio.
 */

function pedido(sobrescreve: Record<string, unknown> = {}): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: `${id}@bruxario.local`,
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'aries',
    signo_lua: 'aries',
    produto: 'revelacao',
  });
  atualizarPedido(id, { status: 'entregue', ...sobrescreve });
  return id;
}

beforeEach(() => {
  db.exec("DELETE FROM pedidos WHERE email LIKE '%@bruxario.local'");
});

describe('quem pode ser melhorado', () => {
  test('uma Revelação já entregue', () => {
    assert.ok(podeMelhorar(buscarPedido(pedido())!));
  });

  test('não quem ainda não recebeu — não há o que melhorar', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ status: 'aguardando_pagamento' }))!), false);
  });

  test('não quem já tem a Completa', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ produto: 'completa' }))!), false);
  });

  /** A trava contra cobrar duas vezes pela mesma melhoria. */
  test('não quem já melhorou', () => {
    const id = pedido();
    atualizarPedido(id, { melhoria_paga_em: new Date().toISOString() });
    assert.equal(podeMelhorar(buscarPedido(id)!), false);
  });

  test('amostras nossas ficam de fora', () => {
    assert.equal(podeMelhorar(buscarPedido(pedido({ exemplo: 1 }))!), false);
  });
});

describe('o pagamento da melhoria', () => {
  /**
   * O webhook casa a notificação por este campo. Se ele gravasse no
   * `pagamento_id` normal, a confirmação da melhoria seria lida como reenvio
   * da compra original e descartada — a pessoa pagaria e não receberia nada.
   */
  test('é gravado num campo separado do pagamento original', () => {
    const id = pedido({ pagamento_id: 'mp-compra-original' });
    anotarPagamentoDaMelhoria(id, 'mp-melhoria');

    const p = buscarPedido(id)!;
    assert.equal(p.pagamento_id, 'mp-compra-original', 'o original não é sobrescrito');
    assert.equal(p.melhoria_pagamento_id, 'mp-melhoria');
  });

  test('o webhook acha o pedido pelo id da melhoria', () => {
    const id = pedido();
    anotarPagamentoDaMelhoria(id, 'mp-xyz');
    assert.equal(buscarPedidoPorMelhoria('mp-xyz')?.id, id);
  });

  test('id que não é de melhoria nenhuma devolve undefined', () => {
    assert.equal(buscarPedidoPorMelhoria('mp-inexistente'), undefined);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * A regeneração não pode ser aguardada dentro do webhook.
 * ──────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs';

/**
 * O CÓDIGO, sem os comentários.
 *
 * A primeira versão deste teste procurava `await processarPedido(...)` no
 * arquivo inteiro — e falhava, porque o comentário que EXPLICA o bug cita a
 * linha antiga. Um teste que lê fonte precisa ler só o que executa.
 */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('o upgrade não segura o webhook', () => {
  /**
   * O caso real de 21/08: uma cliente pagou o upgrade às 19:45, o webhook
   * confirmou às 19:46, a geração começou dentro da requisição e morreu no
   * meio. O pedido ficou em `gerando` por dez horas.
   *
   * E a retentativa do gateway — a rede que existe exatamente para isso — não
   * salvou: `melhoria_paga_em` já estava gravado, `confirmarMelhoria` devolvia
   * "já processado", e nada era refeito.
   */
  test('confirmarMelhoria devolve a promessa em vez de aguardá-la', () => {
    const fonte = codigoDe('src/nucleo/melhoria.ts');
    assert.ok(
      /entrega: processarPedido\(pedidoId\)/.test(fonte),
      'a geração precisa sair como promessa para quem chama decidir'
    );
    assert.ok(
      !/await processarPedido\(pedidoId\)/.test(fonte),
      'aguardar aqui devolve o bug: o webhook segura pelo tempo da geração'
    );
  });

  test('o webhook não espera a regeneração', () => {
    const fonte = codigoDe('src/lib/webhook-pagamento.ts');
    assert.ok(
      /const \{ aplicou, entrega \} = await confirmarMelhoria/.test(fonte),
      'o webhook precisa receber a promessa'
    );
    assert.ok(
      !/await confirmarMelhoria\([^)]*\)[\s\S]{0,80}await entrega/.test(fonte),
      'o webhook nunca pode aguardar a entrega — tem 8s para responder'
    );
  });

  /**
   * `pedidosTravados()` procura `gerando` com `tentativas < 3`. Se a melhoria
   * não deixasse o pedido em `gerando`, uma geração morta ficaria invisível
   * para `npm run reprocessar` — sem rede nenhuma embaixo.
   */
  test('o pedido fica em `gerando`, que é o que o reprocessamento enxerga', () => {
    const fonte = codigoDe('src/nucleo/melhoria.ts');
    assert.ok(/status: 'gerando'/.test(fonte));
  });
});
