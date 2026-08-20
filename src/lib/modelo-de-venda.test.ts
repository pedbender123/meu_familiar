import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import db from './db';
import { definirInterruptor } from './interruptores';
import {
  CHAVE_DO_MODELO_NOVO,
  modeloNovoLigado,
  precoVigenteCentavos,
  produtoVigente,
  destinoDepoisDaEntrega,
} from './modelo-de-venda';

/**
 * O desvio provisório existe para produção receber 57 commits sem trocar o
 * negócio no meio de uma campanha que está no ar vendendo a R$ 9,80.
 *
 * O que estes testes protegem é a única coisa que não pode falhar: **com o
 * interruptor desligado, o site cobra o que sempre cobrou.**
 */

function ligar(v: boolean) {
  definirInterruptor({ chave: CHAVE_DO_MODELO_NOVO, ligado: v, percentual: 100 });
}

beforeEach(() => {
  db.exec('DELETE FROM interruptores');
});

describe('desligado — o modelo de produção', () => {
  test('sem registro nenhum no banco já está desligado', () => {
    assert.equal(modeloNovoLigado(), false, 'caminho novo nasce desligado');
  });

  /** O erro que custaria dinheiro: entregar de graça o que o anúncio cobra. */
  test('a Revelação custa o preço da campanha, não zero', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 980);
    assert.equal(produtoVigente('revelacao').precoCentavos, 980);
  });

  test('depois da entrega vai para a revelação, como produção faz hoje', () => {
    assert.equal(destinoDepoisDaEntrega('abc'), '/revelacao/abc');
  });

  /**
   * A porta sem landing já está em produção desde 19/08 e é o que a campanha
   * em curso usa para converter. Se ela passasse pelo interruptor, subir com
   * a chave desligada devolveria a landing para quem hoje cai direto na
   * pergunta — desfazendo justamente o que fez o funil funcionar.
   */
  test('o interruptor não toca na porta sem landing', () => {
    const raiz = readFileSync('src/app/page.tsx', 'utf8');
    assert.ok(
      !raiz.includes('modeloNovoLigado'),
      'a raiz não pode consultar o interruptor para decidir landing'
    );
  });

  test('produtos que não mudaram de preço seguem iguais', () => {
    assert.equal(precoVigenteCentavos('completa'), 1890);
  });
});

describe('ligado — o modelo novo', () => {
  beforeEach(() => ligar(true));

  test('a Revelação é grátis', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 0);
  });

  test('depois da entrega vai para a oferta de três degraus', () => {
    assert.equal(destinoDepoisDaEntrega('abc'), '/oferta/abc');
  });
});

describe('virar a chave', () => {
  test('desligar volta ao preço antigo na hora, sem deploy', () => {
    ligar(true);
    assert.equal(precoVigenteCentavos('revelacao'), 0);
    ligar(false);
    assert.equal(precoVigenteCentavos('revelacao'), 980);
  });
});
