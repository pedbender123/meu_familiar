import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { vitrine, vitrineEmEscada } from './vitrine';
import type { Direitos } from './direitos';

describe('a vitrine como escada', () => {
  test('o degrau mais barato mostra a lista inteira — não há anterior', () => {
    const mensais = vitrineEmEscada().filter((i) => !i.anual);
    if (mensais.length === 0) return;
    assert.deepEqual(mensais[0].ganhos, mensais[0].beneficios);
  });

  /**
   * "Tudo da Vigília, e:" só é verdade se o degrau de cima realmente contiver
   * o de baixo. A verificação é feita nos DIREITOS, não no texto: as frases
   * são quantificadas ("4 leituras" vira "10 leituras"), então um degrau
   * maior legitimamente substitui a linha em vez de somar outra. Comparar
   * strings aqui acusaria perda onde houve ganho.
   */
  test('cada degrau entrega tudo do anterior, medido nos direitos', () => {
    const booleanos: (keyof Direitos)[] = [
      'pdf', 'imagens', 'relatorioCompleto', 'graficos', 'perfilPublico',
      'tiragemDiaria', 'narracaoAudio', 'perfilCompleto', 'oraculoNaHora',
      'conselhoDiario', 'guiaPorEmail',
    ];
    const numericos: (keyof Direitos)[] = [
      'perguntasOraculo', 'perguntasOraculoPorDia', 'leiturasPorMes',
    ];

    for (const prazo of [false, true]) {
      const degraus = vitrineEmEscada().filter((i) => i.anual === prazo);
      for (let i = 1; i < degraus.length; i++) {
        const antes = degraus[i - 1];
        const agora = degraus[i];

        for (const campo of booleanos) {
          if (antes.direitos[campo]) {
            assert.ok(
              agora.direitos[campo],
              `${agora.plano.id} perdeu "${campo}", que ${antes.plano.id} tem`
            );
          }
        }
        for (const campo of numericos) {
          assert.ok(
            (agora.direitos[campo] as number) >= (antes.direitos[campo] as number),
            `${agora.plano.id} tem menos "${campo}" que ${antes.plano.id}`
          );
        }
      }
    }
  });

  test('os ganhos são exatamente a diferença, sem repetir o que já veio', () => {
    for (const prazo of [false, true]) {
      const degraus = vitrineEmEscada().filter((i) => i.anual === prazo);
      for (let i = 1; i < degraus.length; i++) {
        const anteriores = new Set(degraus[i - 1].beneficios);
        for (const g of degraus[i].ganhos) {
          assert.ok(!anteriores.has(g), `"${g}" já estava no degrau anterior`);
        }
        const esperado = degraus[i].beneficios.filter((b) => !anteriores.has(b));
        assert.deepEqual(degraus[i].ganhos, esperado);
      }
    }
  });

  /** Comparar anual com mensal na mesma escada mediria a diferença errada. */
  test('a escada é calculada dentro de cada prazo, não entre prazos', () => {
    const anuais = vitrineEmEscada().filter((i) => i.anual);
    if (anuais.length === 0) return;
    assert.deepEqual(anuais[0].ganhos, anuais[0].beneficios);
  });

  test('o gratuito nunca entra na vitrine', () => {
    assert.ok(!vitrine().some((i) => i.plano.id === 'gratuito'));
  });
});
