import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from '../lib/db';
import { definirInterruptor } from '../lib/interruptores';
import {
  CHAVE_PLANOS_FECHADOS,
  CHAVE_DO_MODELO_NOVO,
  planosVendaveis,
  precoVigenteCentavos,
} from '../lib/modelo-de-venda';

/**
 * A venda de plano.
 *
 * ── O que estes testes travam ─────────────────────────────────────────────
 *
 * `abrirCobranca` começava com `if (!modeloNovoLigado()) return null`. Como o
 * interruptor do modelo vive desligado — ele zera o preço da Revelação, que é
 * o que a campanha vende —, **nenhum plano jamais pôde ser comprado.**
 *
 * E não era silencioso do jeito bom: `/planos` continuava mostrando os três
 * planos com preço, e clicar respondia "plano indisponível". O banco de
 * produção confirmou o estrago — zero cobranças de plano, sempre.
 *
 * O que não pode voltar: as duas decisões na mesma chave.
 */

beforeEach(() => {
  db.exec('DELETE FROM interruptores');
});

function ligar(chave: string, v: boolean) {
  definirInterruptor({ chave, ligado: v, percentual: 100 });
}

describe('plano é vendável por padrão', () => {
  test('sem registro nenhum, vende', () => {
    assert.equal(planosVendaveis(), true, 'a página anuncia; a compra precisa funcionar');
  });

  /**
   * O ponto inteiro da mudança: vender plano NÃO pode mais custar zerar o
   * preço da Revelação.
   */
  test('vender plano não depende do interruptor do modelo', () => {
    ligar(CHAVE_DO_MODELO_NOVO, false);
    assert.equal(planosVendaveis(), true);
    assert.equal(
      precoVigenteCentavos('revelacao'),
      2362,
      'e a Revelação continua com o preço cheio da campanha'
    );
  });

  test('com o modelo novo ligado também vende', () => {
    ligar(CHAVE_DO_MODELO_NOVO, true);
    assert.equal(planosVendaveis(), true);
  });
});

describe('a trava de emergência', () => {
  /** Interruptor de emergência, não de estreia: ausente = vendendo. */
  test('ligar `planos_fechados` tranca a venda na hora', () => {
    ligar(CHAVE_PLANOS_FECHADOS, true);
    assert.equal(planosVendaveis(), false);
  });

  test('desligar destranca, sem deploy', () => {
    ligar(CHAVE_PLANOS_FECHADOS, true);
    assert.equal(planosVendaveis(), false);
    ligar(CHAVE_PLANOS_FECHADOS, false);
    assert.equal(planosVendaveis(), true);
  });

  test('trancar plano não mexe no preço da Revelação', () => {
    ligar(CHAVE_PLANOS_FECHADOS, true);
    assert.equal(precoVigenteCentavos('revelacao'), 2362);
  });
});
