import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * O upgrade de R$ 4,90 não pode reescrever a leitura.
 *
 * ── O que estava errado ───────────────────────────────────────────────────
 *
 * `processarPedido` chamava `gerarLeitura` incondicionalmente. Como o upgrade
 * passa por ele — `confirmarMelhoria` troca o produto para `completa` e manda
 * gerar de novo —, quem pagava os R$ 4,90 recebia:
 *
 *   - um texto DIFERENTE do que já tinha lido, e
 *   - uma chamada de IA inteira, para produzir arquivos que saem do texto
 *     que já existia.
 *
 * O upgrade é barato de propósito: ele desbloqueia gráficos, link e narração,
 * coisas que não têm custo marginal. Regerar a leitura destruía as duas
 * pontas do raciocínio — o preço e a promessa.
 *
 * Vale igual para o reprocessamento de um pedido que morreu no meio: se a
 * leitura sobreviveu, refazê-la troca o texto de quem já viu o primeiro.
 */

function codigo(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a leitura já escrita é reaproveitada', () => {
  const fonte = codigo('src/lib/processar.ts');

  test('só gera quando não existe leitura gravada', () => {
    assert.ok(
      /pedido\.leitura_json\s*\?[\s\S]{0,200}:\s*await gerarLeitura\(/.test(fonte),
      'gerarLeitura precisa estar atrás da checagem de leitura_json'
    );
  });

  test('não há chamada incondicional a gerarLeitura', () => {
    assert.ok(
      !/^\s*const leitura = await gerarLeitura\(/m.test(fonte),
      'chamada incondicional reescreve o texto de quem só pagou pelo desbloqueio'
    );
  });

  /**
   * O upgrade continua passando por `processarPedido` — é ele que produz
   * gráficos, narração e o PDF completo. O que muda é só a leitura.
   */
  test('o upgrade continua mandando gerar os arquivos', () => {
    const melhoria = codigo('src/nucleo/melhoria.ts');
    assert.ok(/processarPedido\(pedidoId\)/.test(melhoria));
    assert.ok(/produto: 'completa'/.test(melhoria));
  });
});
