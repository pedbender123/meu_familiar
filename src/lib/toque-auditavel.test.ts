import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('cada toque de campanha fica registrado', () => {
  /**
   * Em 24/08 foi pedido para corrigir a atribuição de pedidos antigos, e não
   * deu: o código da campanha (`?c=ig01`) era consumido, virava cookie, e só
   * a campanha JÁ RESOLVIDA chegava ao pedido. `visitas.caminho` é gravado
   * sem query string — zero visitas com `?c=` no banco inteiro.
   *
   * Não existia registro de qual link cada pessoa clicou. Reatribuir teria
   * sido adivinhação, e histórico reescrito no chute é pior que histórico
   * errado, porque parece certo.
   */
  test('a visita guarda a campanha do toque', () => {
    const fonte = codigoDe('src/app/api/visita/route.ts');
    assert.match(fonte, /campanha_id: campanha\?\.id \?\? null/);
    assert.match(fonte, /peca_id: peca\?\.id \?\? null/);
  });

  /**
   * O toque, não o crédito. `deveSubstituir` pode recusar este clique — e é
   * justamente o clique recusado que se quer poder auditar depois, porque é
   * ele que explica por que a venda foi creditada a outra campanha.
   */
  test('registrarVisita aceita e persiste as colunas', () => {
    const fonte = codigoDe('src/lib/analitica.ts');
    assert.match(fonte, /campanha_id\?: string \| null;/);
    assert.match(fonte, /dispositivo, campanha_id, peca_id, criado_em/);
    assert.match(fonte, /campanha_id: null, peca_id: null, \.\.\.v/);
  });

  /** Analítica nunca pode derrubar o site — nem com coluna nova. */
  test('a gravação continua dentro do try', () => {
    const fonte = codigoDe('src/app/api/visita/route.ts');
    const i = fonte.indexOf('registrarVisita({');
    const j = fonte.lastIndexOf('try {', i);
    assert.ok(j !== -1 && j < i, 'registrarVisita precisa estar dentro de um try');
  });
});
