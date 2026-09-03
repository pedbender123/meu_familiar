import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { podeMelhorar, PRECO_DA_MELHORIA_CENTAVOS } from './melhoria';
import type { Pedido } from '../lib/db';

/**
 * O upgrade para a Completa.
 *
 * ── O que isto trava ──────────────────────────────────────────────────────
 *
 * A melhoria estava inteira em código — página, rota que cobra, preço,
 * confirmação por webhook — e **nenhum lugar do site levava até ela**. Uma
 * página de compra sem link é receita que nunca acontece, e o tipo de coisa
 * que some justamente porque nada quebra.
 */

function pedido(over: Partial<Pedido> = {}): Pedido {
  return {
    status: 'entregue',
    produto: 'revelacao',
    melhoria_paga_em: null,
    exemplo: 0,
    ...over,
  } as Pedido;
}

describe('quem recebe a oferta', () => {
  test('quem comprou a Revelação simples e já recebeu', () => {
    assert.equal(podeMelhorar(pedido()), true);
  });

  /** Oferecer a alguém o que já comprou custa a confiança do comprador. */
  test('quem já tem a Completa, não', () => {
    assert.equal(podeMelhorar(pedido({ produto: 'completa' })), false);
  });

  test('quem já pagou a melhoria, não', () => {
    assert.equal(
      podeMelhorar(pedido({ melhoria_paga_em: '2026-08-22T00:00:00Z' })),
      false
    );
  });

  test('os exemplos do mural, não — não são cliente', () => {
    assert.equal(podeMelhorar(pedido({ exemplo: 1 })), false);
  });

  test('quem ainda não recebeu, não — a entrega vem antes da oferta', () => {
    assert.equal(podeMelhorar(pedido({ status: 'aguardando_pagamento' })), false);
  });
});

describe('a oferta chega nos dois canais', () => {
  /**
   * Os dois, e não um: nem todo mundo volta ao link depois de fechar a aba, e
   * nem todo mundo abre o e-mail.
   */
  test('na revelação, guardada por `ehADona` e `podeMelhorar`', () => {
    // O corpo da revelação virou componente — ver `CorpoDaRevelacao`.
    const fonte = readFileSync('src/components/revelacao/CorpoDaRevelacao.tsx', 'utf8');
    assert.ok(fonte.includes('OfertaDaCompleta'), 'a oferta precisa estar na página');
    assert.ok(
      /ehADona && podeMelhorar\(pedido\)/.test(fonte),
      'sem a guarda, quem abre o link compartilhado recebe oferta de um pedido alheio'
    );
  });

  test('no e-mail de entrega, só para quem tem a Revelação simples', () => {
    const fonte = readFileSync('src/lib/email.ts', 'utf8');
    assert.ok(
      /ofereceUpgrade = produtoId === 'revelacao'/.test(fonte),
      'o e-mail precisa filtrar por produto'
    );
    assert.ok(fonte.includes('/melhorar/'), 'o e-mail precisa linkar a página de upgrade');
  });

  test('o preço é o mesmo nos dois lugares, lido de uma fonte só', () => {
    assert.equal(PRECO_DA_MELHORIA_CENTAVOS, 490);
    for (const caminho of ['src/lib/email.ts', 'src/components/OfertaDaCompleta.tsx']) {
      const fonte = readFileSync(caminho, 'utf8');
      assert.ok(
        fonte.includes('PRECO_DA_MELHORIA_CENTAVOS'),
        `${caminho} precisa ler o preço da constante, não escrever 4,90 na mão`
      );
    }
  });
});
