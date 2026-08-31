import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nenhum redirecionamento pode nascer de `req.url`.
 *
 * ── Por que um teste, e não confiança ─────────────────────────────────────
 *
 * Atrás do nginx, `req.url` é `http://localhost:3000`. Redirecionar a partir
 * dele manda a pessoa para um host que não existe no navegador dela — e o
 * modo de falha é traiçoeiro: em desenvolvimento `req.url` já é localhost, e
 * tudo passa.
 *
 * Este erro já foi cometido duas vezes neste projeto. A primeira quebrou
 * **todo login em produção**; a segunda, o alternador de visão do painel,
 * meses depois, por quem não sabia que a armadilha existia. As duas vezes só
 * apareceram no ar, com alguém clicando.
 *
 * Um comentário não impediu a segunda. Um teste impede a terceira.
 */
function arquivosDeRota(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeRota(caminho, achados);
    else if (nome === 'route.ts' || nome === 'route.tsx') achados.push(caminho);
  }
  return achados;
}

describe('redirecionamento atrás do nginx', () => {
  test('nenhuma rota monta destino a partir de req.url', () => {
    const culpados: string[] = [];

    for (const arquivo of arquivosDeRota('src/app')) {
      const fonte = readFileSync(arquivo, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      // `new URL(<algo>, req.url)` — a forma exata da armadilha.
      if (/new URL\([^)]*,\s*req\.url\s*\)/.test(fonte)) culpados.push(arquivo);
    }

    assert.deepEqual(
      culpados,
      [],
      `estas rotas redirecionam para localhost em produção: ${culpados.join(', ')}. ` +
        'Use destinoAbsoluto() de @/lib/destino-absoluto.'
    );
  });

  /**
   * E a função existe num lugar só. Ela já esteve privada dentro do arquivo
   * do login — foi exatamente por isso que o segundo caso aconteceu: a
   * correção não estava onde a próxima pessoa iria procurar.
   */
  test('a função mora num lugar só', () => {
    const definicoes = arquivosDeRota('src/app').filter((a) =>
      /function destinoAbsoluto/.test(readFileSync(a, 'utf8'))
    );
    assert.deepEqual(definicoes, [], 'destinoAbsoluto foi copiada para dentro de uma rota');
  });

  /** E ela prefere BASE_URL, caindo em req.url só quando não há BASE_URL. */
  test('prefere BASE_URL', () => {
    const fonte = readFileSync('src/lib/destino-absoluto.ts', 'utf8');
    assert.match(fonte, /process\.env\.BASE_URL/);
    assert.match(fonte, /base \|\| req\.url/);
  });
});
