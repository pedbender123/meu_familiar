import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('o funil de cada vídeo', () => {
  const fonte = codigoDe('src/lib/campanhas.ts');

  /**
   * Uma pessoa que recarregou a página três vezes é uma pessoa, não três.
   * Sem `DISTINCT` a retenção passa de 100% e o gráfico deixa de fazer
   * sentido — e um gráfico que mente é pior que gráfico nenhum quando ele vai
   * ser mostrado para o parceiro que pagou o anúncio.
   */
  test('todo degrau conta pessoa, não evento', () => {
    const i = fonte.indexOf('export function funilDaPeca');
    const trecho = fonte.slice(i);
    assert.ok(!/COUNT\(\*\) AS n\b/.test(trecho.slice(0, trecho.indexOf('const vendas'))));
    assert.match(trecho, /COUNT\(DISTINCT m\.visitante\)/);
    assert.match(trecho, /COUNT\(DISTINCT t\.visitante\)/);
  });

  /**
   * "Terminou as 26" sai da cena mais alta, não de `nome_ok`. Não existe
   * evento "acabou o ritual" — o que existe é `cena` com o número. `nome_ok`
   * mediria outra coisa: quem preencheu o nome, que vem depois e perde gente
   * por outro motivo.
   */
  test('terminar as 26 é medido pela cena, não pelo nome', () => {
    assert.match(fonte, /m\.marco = 'cena' AND m\.valor >= 26/);
  });

  test('os sete degraus que o dono pediu', () => {
    for (const r of [
      'Chegaram pelo link',
      'Abriram o ritual',
      'Responderam ao menos 1',
      'Terminaram as 26',
      'Viram a oferta',
      'Abriram o checkout',
      'Pagaram',
    ]) {
      assert.ok(fonte.includes(r), `falta o degrau "${r}"`);
    }
  });

  /**
   * A Meta distribui sozinha entre Instagram e Facebook, e o mesmo criativo
   * rende diferente em cada um. Sem a quebra, um vídeo que converte bem numa
   * rede e mal na outra aparece como mediano nas duas — e a decisão de pausar
   * sai errada.
   */
  test('a origem é quebrada por rede', () => {
    assert.match(fonte, /COALESCE\(t\.origem, 'sem origem'\) AS origem/);
  });

  /**
   * `= NULL` não distingue "esta peça" de "sem peça nenhuma" em SQL. O
   * tráfego sem peça é o do link da bio — origem de verdade, não erro.
   */
  test('sem peça é filtrado com IS NULL, não com igualdade', () => {
    assert.match(fonte, /pecaId \? 't\.peca_id = @peca' : 't\.peca_id IS NULL'/);
  });

  /** Receita sai de `precoDoPedido`, senão o painel diverge do que foi cobrado. */
  test('a receita respeita o cupom congelado no pedido', () => {
    const i = fonte.indexOf('export function funilDaPeca');
    assert.match(fonte.slice(i), /precoDoPedido\(p\)\.finalCentavos/);
  });
});

describe('a tela do vídeo', () => {
  const fonte = codigoDe('src/app/painel/campanhas/[id]/peca/[pecaId]/page.tsx');

  test('só admin entra', () => {
    assert.match(fonte, /sessao\.tipo !== 'admin'/);
  });

  test('sem-peca na URL vira o tráfego sem peça', () => {
    assert.match(fonte, /pecaId === 'sem-peca' \? null : pecaId/);
  });

  test('a tabela da campanha leva até ela', () => {
    const pecas = codigoDe('src/components/painel/Pecas.tsx');
    assert.match(pecas, /painel\/campanhas\/\$\{campanhaId\}\/peca\/\$\{l\.peca_id \?\? 'sem-peca'\}/);
  });
});
