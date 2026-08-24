import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { podeGerar, GERACAO_MORTA_APOS_MS } from './processar';

/**
 * O resgate de uma geração morta.
 *
 * ── O bug, e por que ele era invisível ────────────────────────────────────
 *
 * `pedidosTravados()` procura pedidos em `pago`, `gerando` e `erro` — inclui
 * `gerando` de propósito, porque é onde fica quem morreu no meio da geração.
 * Mas `processarPedido` recusava `gerando` e voltava **em silêncio**.
 *
 * Resultado: `npm run reprocessar` listava o pedido, chamava a função, nada
 * acontecia, e o script imprimia "Concluído". A rede existia, era chamada, e
 * não pegava nada. Uma cliente que pagou o upgrade em 21/08 ficou catorze
 * horas presa assim, e só apareceu porque alguém foi olhar o banco à mão.
 *
 * O que separa "gerando agora" de "morreu gerando" é o relógio:
 * `atualizado_em` para de andar quando o processo cai.
 */

const AGORA = Date.parse('2026-08-22T12:00:00.000Z');
const minutosAtras = (m: number) => new Date(AGORA - m * 60_000).toISOString();

describe('quem pode entrar em geração', () => {
  test('pago entra — é o caminho normal', () => {
    assert.equal(podeGerar({ status: 'pago' }, AGORA), true);
  });

  test('erro entra — é para isso que a retentativa existe', () => {
    assert.equal(podeGerar({ status: 'erro' }, AGORA), true);
  });

  test('entregue não entra — não se gera de novo o que já foi entregue', () => {
    assert.equal(podeGerar({ status: 'entregue' }, AGORA), false);
  });

  test('aguardando_pagamento não entra — ninguém pagou ainda', () => {
    assert.equal(podeGerar({ status: 'aguardando_pagamento' }, AGORA), false);
  });
});

describe('gerando: viva ou morta', () => {
  /** Duas gerações sobre o mesmo pedido é o que o guard antigo evitava. */
  test('geração recente NÃO é retomada — ela ainda está rodando', () => {
    assert.equal(
      podeGerar({ status: 'gerando', atualizado_em: minutosAtras(1) }, AGORA),
      false
    );
  });

  test('no limite dos 10 minutos ainda é considerada viva', () => {
    const noLimite = new Date(AGORA - GERACAO_MORTA_APOS_MS).toISOString();
    assert.equal(podeGerar({ status: 'gerando', atualizado_em: noLimite }, AGORA), false);
  });

  /** O caso da cliente de 21/08: catorze horas em `gerando`. */
  test('geração parada há horas É retomada', () => {
    assert.equal(
      podeGerar({ status: 'gerando', atualizado_em: minutosAtras(14 * 60) }, AGORA),
      true
    );
  });

  /**
   * Um pedido preso em `gerando` sem saber desde quando é exatamente o que
   * precisa de resgate — recusar por falta de carimbo o deixaria preso.
   */
  test('sem carimbo legível, assume morta e resgata', () => {
    assert.equal(podeGerar({ status: 'gerando', atualizado_em: null }, AGORA), true);
    assert.equal(podeGerar({ status: 'gerando', atualizado_em: 'lixo' }, AGORA), true);
  });
});
