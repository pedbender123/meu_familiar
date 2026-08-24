import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ITENS } from './itens';
import { itensNaOrdemDeExibicao, CENA_DE_ABERTURA } from './ordem';

/**
 * A cena que abre o ritual.
 *
 * ── O número que motivou isto ─────────────────────────────────────────────
 *
 * Entre 21 e 23/08: **71 pessoas chegaram no ritual e 43 saíram sem responder
 * uma única cena** — 61% de abandono no primeiro toque, contra perdas de 5% a
 * 32% em todos os outros degraus do funil.
 *
 * A abertura era a `q01`, sobre falar primeiro numa roda de conversa: nenhuma
 * ligação com o anúncio que prometia descobrir um familiar de bruxa.
 */

describe('a abertura', () => {
  test('é a cena do sonho, não a da roda de conversa', () => {
    assert.equal(CENA_DE_ABERTURA, 'q17');
    assert.equal(itensNaOrdemDeExibicao()[0].id, 'q17');
  });

  test('as opções da abertura são curtas — o primeiro clique é o mais caro', () => {
    const abertura = itensNaOrdemDeExibicao()[0];
    for (const o of abertura.opcoes) {
      const palavras = o.texto.split(/\s+/).length;
      assert.ok(palavras <= 9, `"${o.texto}" tem ${palavras} palavras; o teto é 9`);
    }
  });

  /** Reordenar exibição não pode perder nem duplicar cena. */
  test('as 26 cenas continuam todas lá, uma vez cada', () => {
    const ordem = itensNaOrdemDeExibicao();
    assert.equal(ordem.length, ITENS.length);
    assert.equal(new Set(ordem.map((i) => i.id)).size, ITENS.length);
  });

  /**
   * A pontuação soma `cargas` por item — não depende da ordem. Este teste
   * existe para que uma mudança futura no motor não passe despercebida.
   */
  test('a ordem de exibição não altera o conjunto pontuado', () => {
    const antes = ITENS.map((i) => i.id).sort();
    const depois = itensNaOrdemDeExibicao().map((i) => i.id).sort();
    assert.deepEqual(depois, antes);
  });
});
