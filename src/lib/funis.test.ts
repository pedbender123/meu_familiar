import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ESCOLHA_DE_FUNIL_LIGADA,
  FUNIL_PADRAO,
  FUNIS,
  funilPorCodigo,
  funisDaCampanha,
  sortearEntre,
} from './funis';

/**
 * A escolha de funil está desligada, e este arquivo é a trava disso.
 *
 * O teste A/B existia e não provou nada: só as 26 cenas venderam. Enquanto
 * `ESCOLHA_DE_FUNIL_LIGADA` for `false`, toda campanha serve as 26 cenas — e
 * o que quebra essa promessa é justamente o caso silencioso: uma campanha
 * antiga com `atravessar` gravado na coluna continuar servindo `atravessar`
 * para tráfego pago sem ninguém perceber.
 */
describe('com a escolha desligada', () => {
  test('campanha nenhuma escapa das 26 cenas', () => {
    assert.equal(ESCOLHA_DE_FUNIL_LIGADA, false);
    assert.deepEqual(funisDaCampanha(null), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('["atravessar"]'), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('["atravessar","familiar"]'), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('lixo que não é json'), [FUNIL_PADRAO]);
  });

  test('sortear entre os inativos cai no padrão', () => {
    assert.equal(sortearEntre(['atravessar', 'familiar']), FUNIL_PADRAO);
    assert.equal(sortearEntre([]), FUNIL_PADRAO);
  });

  test('só as 26 cenas estão ativas', () => {
    const ativos = Object.values(FUNIS).filter((f) => f.ativo).map((f) => f.id);
    assert.deepEqual(ativos, [FUNIL_PADRAO]);
  });
});

/**
 * Os desligados continuam no registro de propósito: existem pedidos gravados
 * com eles, e o relatório os lê pelo código de duas letras. Apagar a entrada
 * faria a jornada de agosto virar linha em branco.
 */
describe('o histórico continua legível', () => {
  test('os códigos antigos ainda resolvem', () => {
    assert.equal(funilPorCodigo('at')?.id, 'atravessar');
    assert.equal(funilPorCodigo('fa')?.id, 'familiar');
    assert.equal(funilPorCodigo('pd')?.id, 'padrao');
  });

  test('código desconhecido não inventa funil', () => {
    assert.equal(funilPorCodigo('zz'), null);
    assert.equal(funilPorCodigo(null), null);
  });
});
