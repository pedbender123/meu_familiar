import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { centavosDeTexto, microcentavosDeTexto } from './custos';

/**
 * A ordem de grandeza do que a assinatura consome.
 *
 * ── O que estes números são ───────────────────────────────────────────────
 *
 * 653 tokens de entrada e 579 de saída são a medida real de uma consulta ao
 * Oráculo, tirada de uma linha de produção em 01/09. Não é um exemplo
 * inventado para o teste passar — é o caso que fez o painel de custo por
 * assinante nascer mostrando zero.
 */
const UMA_CONSULTA = { tokensEntrada: 653, tokensSaida: 579 };

describe('o custo de uma consulta ao Oráculo', () => {
  /**
   * O comportamento antigo, preservado no teste para que ninguém "conserte"
   * `centavosDeTexto` sem entender o que ela é. Ela não está errada: 0,17
   * centavo arredondado É zero. Ela é a unidade errada para esta pergunta.
   */
  test('em centavos inteiros, ela custa zero', () => {
    assert.equal(centavosDeTexto(UMA_CONSULTA), 0);
  });

  test('em milésimos de centavo, ela custa o que custa', () => {
    const micro = microcentavosDeTexto(UMA_CONSULTA);
    assert.ok(micro > 0, 'não pode ser zero — é isso que a coluna existe para evitar');
    // 0,166 centavo. A folga aceita reajuste de câmbio sem virar teste frágil.
    assert.ok(micro > 100 && micro < 300, `esperava ~166 milésimos, veio ${micro}`);
  });

  /**
   * O teste que importa: **cem consultas não podem somar zero.**
   *
   * É a diferença entre o painel responder "esta pessoa custou 17 centavos" e
   * responder "esta pessoa custou nada" — e a segunda resposta é a que faz um
   * assinante deficitário passar despercebido.
   */
  test('cem consultas somam algo, em vez de somarem nada', () => {
    const cemEmCentavos = 100 * centavosDeTexto(UMA_CONSULTA);
    assert.equal(cemEmCentavos, 0, 'era este o estado do banco em 01/09');

    const cemEmMicro = 100 * microcentavosDeTexto(UMA_CONSULTA);
    assert.equal(Math.round(cemEmMicro / 1000), 17);
  });

  /** O modelo barato precisa custar menos, senão a tabela de preços está trocada. */
  test('o modelo pequeno custa menos que o grande', () => {
    assert.ok(
      microcentavosDeTexto({ ...UMA_CONSULTA, modelo: 'gemini-3.1-flash-lite' }) <
        microcentavosDeTexto({ ...UMA_CONSULTA, modelo: 'gemini-3.5-flash-lite' })
    );
  });

  /** Mil vezes o valor em centavos, quando o valor em centavos é grande. */
  test('as duas unidades concordam quando o número é grande', () => {
    const grande = { tokensEntrada: 500_000, tokensSaida: 200_000 };
    const emCentavos = centavosDeTexto(grande);
    const emMicro = microcentavosDeTexto(grande);
    assert.ok(Math.abs(emMicro / 1000 - emCentavos) < 1);
  });
});
