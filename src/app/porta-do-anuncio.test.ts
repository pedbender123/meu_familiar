import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * A porta que o anúncio abre.
 *
 * ── O bug que isto trava ──────────────────────────────────────────────────
 *
 * A raiz só abre direto na primeira cena quando a chegada vem "marcada", e a
 * marcação era `?c=`, `?de=` ou `?s=`. O link do anúncio na Meta não carrega
 * nenhum deles — carrega `utm_source=FB&utm_campaign=...`.
 *
 * Resultado, com campanha no ar: todo clique de anúncio caía na **landing**,
 * a página que foi tirada do caminho em 19/08 justamente por matar conversão.
 * O site respondia 200, nada aparecia em log, e a única evidência era a
 * conversão pior.
 *
 * Teste de código e não de comportamento, pelo mesmo motivo do
 * `modelo-de-venda.test.ts`: o que precisa ser garantido é que a regra de
 * marcação CONTINUE considerando o anúncio, e uma refatoração futura que
 * reescreva `decidir` de outro jeito não pode reintroduzir o furo em silêncio.
 */
describe('a raiz reconhece a chegada de anúncio', () => {
  const fonte = readFileSync('src/app/page.tsx', 'utf8');

  test('utm_source conta como marcador', () => {
    assert.ok(
      /marcadoPorAnuncio\s*=\s*!!utm_source/.test(fonte),
      'sem isto, o clique do anúncio cai na landing em vez da primeira cena'
    );
  });

  test('o marcador do anúncio entra na conta de `temMarcador`', () => {
    assert.ok(
      /marcadoPorRede\s*=[^;]*marcadoPorAnuncio/.test(fonte),
      'calcular `marcadoPorAnuncio` e não usar é pior que não calcular'
    );
  });

  test('`utm_source` chega até `decidir` vindo dos searchParams', () => {
    assert.ok(
      /const \{ c, de, s, utm_source \} = await searchParams/.test(fonte),
      'o parâmetro precisa ser lido da URL'
    );
    assert.ok(
      /decidir\(\{ c, de, s, utm_source, biscoitos \}\)/.test(fonte),
      'e repassado para quem decide'
    );
  });
});
