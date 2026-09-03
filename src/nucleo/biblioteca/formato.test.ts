import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { lerLivro, paginarCapitulo } from './formato';

/**
 * O parser do livro precisa aguentar texto escrito por gente — e por modelo
 * de linguagem seguindo instruções. As duas coisas erram sintaxe, e um parser
 * que explode transforma erro de formatação em livro que não abre.
 */

const LIVRO = `---
id: magia-elemental
titulo: O Fogo Que Você Já É
---

# Módulo 1 — O Fogo

## O que o fogo faz em você
som: fogo-crepitar

O fogo não aquece: ele transforma.
Esta linha continua o mesmo parágrafo.

Este é outro parágrafo.

:::pratica
Feche os olhos e conte três respirações.
:::

Voltando ao texto depois da prática.

## O segundo capítulo

Sem trilha, lido em silêncio.

# Módulo 2 — A Água

## Capítulo da água

Texto.
`;

describe('o Markdown de um livro', () => {
  test('lê frontmatter, módulos e capítulos', () => {
    const livro = lerLivro(LIVRO);
    assert.equal(livro.meta.id, 'magia-elemental');
    assert.equal(livro.meta.titulo, 'O Fogo Que Você Já É');
    assert.equal(livro.modulos.length, 2);
    assert.equal(livro.modulos[0].titulo, 'Módulo 1 — O Fogo');
    assert.equal(livro.modulos[0].capitulos.length, 2);
    assert.equal(livro.modulos[1].capitulos[0].titulo, 'Capítulo da água');
  });

  test('a trilha do capítulo vem do `som:`', () => {
    const livro = lerLivro(LIVRO);
    assert.equal(livro.modulos[0].capitulos[0].som, 'fogo-crepitar');
    assert.equal(livro.modulos[0].capitulos[1].som, null, 'sem som é lido em silêncio');
  });

  /**
   * A quebra de linha no meio do parágrafo é como se escreve Markdown — e é
   * como todo modelo de linguagem escreve. Tratá-la como fim de parágrafo
   * picotaria o texto exatamente como o PDF picota.
   */
  test('linha quebrada não vira parágrafo novo; linha em branco vira', () => {
    const cap = lerLivro(LIVRO).modulos[0].capitulos[0];
    const texto = cap.blocos.filter((b) => b.tipo === 'texto');
    assert.match(texto[0].paragrafos[0], /ele transforma\. Esta linha continua/);
    assert.equal(texto[0].paragrafos.length, 2);
  });

  test('a prática é um bloco separado do texto', () => {
    const cap = lerLivro(LIVRO).modulos[0].capitulos[0];
    assert.deepEqual(
      cap.blocos.map((b) => b.tipo),
      ['texto', 'pratica', 'texto'],
      'o texto depois da prática volta a ser texto'
    );
    assert.match(cap.blocos[1].paragrafos[0], /três respirações/);
  });

  test('conta o tempo de leitura', () => {
    const livro = lerLivro(LIVRO);
    assert.ok(livro.palavras > 20);
    assert.ok(livro.minutos >= 1, 'nunca zero: capítulo curto ainda leva um minuto');
  });
});

describe('o que o parser aguenta sem quebrar', () => {
  test('livro sem frontmatter', () => {
    const livro = lerLivro('## Só um capítulo\n\nTexto.');
    assert.equal(livro.modulos.length, 1);
    assert.equal(livro.modulos[0].capitulos[0].titulo, 'Só um capítulo');
  });

  /** Perder o prefácio porque o autor não pôs cabeçalho seria o parser
   *  decidindo o que é conteúdo. */
  test('texto antes de qualquer cabeçalho vira Abertura', () => {
    const livro = lerLivro('Uma frase solta antes de tudo.\n\n## Capítulo\n\nTexto.');
    assert.equal(livro.modulos[0].capitulos[0].titulo, 'Abertura');
    assert.match(livro.modulos[0].capitulos[0].blocos[0].paragrafos[0], /frase solta/);
  });

  test('prática que ninguém fechou termina no fim do capítulo', () => {
    const livro = lerLivro('## Cap\n\n:::pratica\nRespire.\n\n## Outro\n\nTexto.');
    const primeiro = livro.modulos[0].capitulos[0];
    assert.equal(primeiro.blocos[0].tipo, 'pratica');
    assert.equal(
      livro.modulos[0].capitulos[1].blocos[0].tipo,
      'texto',
      'a prática não vaza para o capítulo seguinte'
    );
  });

  test('livro vazio não explode', () => {
    const livro = lerLivro('');
    assert.deepEqual(livro.modulos, []);
    assert.equal(livro.palavras, 0);
  });

  /**
   * `som:` no meio de um parágrafo é uma frase, não uma diretiva. Trocar a
   * trilha no meio da leitura por causa disso seria um susto.
   */
  test('`som:` só vale antes do texto do capítulo', () => {
    const livro = lerLivro('## Cap\n\nUm texto qualquer.\n\nsom: outro-som\n');
    assert.equal(livro.modulos[0].capitulos[0].som, null);
  });
});

describe('as páginas dentro do capítulo', () => {
  function capituloCom(...tamanhos: { tipo: 'texto' | 'pratica'; palavras: number }[]) {
    return {
      titulo: 'Cap',
      som: null,
      minutos: 0,
      blocos: tamanhos.map((t) => ({
        tipo: t.tipo,
        paragrafos: [Array.from({ length: t.palavras }, () => 'palavra').join(' ')],
      })),
    };
  }

  /**
   * Parágrafo cortado ao meio pela virada de página é o defeito mais visível
   * que um leitor digital pode ter — e prática partida é instrução que
   * ninguém executa direito.
   */
  test('nenhum bloco é partido entre páginas', () => {
    const paginas = paginarCapitulo(capituloCom(
      { tipo: 'texto', palavras: 200 },
      { tipo: 'texto', palavras: 200 },
      { tipo: 'texto', palavras: 200 }
    ), 290);

    const total = paginas.reduce((s, p) => s + p.blocos.length, 0);
    assert.equal(total, 3, 'os três blocos continuam inteiros');
    assert.ok(paginas.length > 1, 'e couberam em mais de uma folha');
  });

  /** A virada de página vira o convite para parar e fazer. */
  test('a prática fecha a página', () => {
    const paginas = paginarCapitulo(capituloCom(
      { tipo: 'texto', palavras: 50 },
      { tipo: 'pratica', palavras: 40 },
      { tipo: 'texto', palavras: 50 }
    ), 290);

    assert.equal(paginas.length, 2);
    assert.equal(paginas[0].blocos[1].tipo, 'pratica', 'a prática é o fim da primeira');
    assert.equal(paginas[1].blocos[0].tipo, 'texto');
  });

  /**
   * Bloco maior que a folha inteira ocupa uma página sozinho. Melhor uma
   * folha longa que uma folha em branco antes dela.
   */
  test('bloco gigante não gera página vazia', () => {
    const paginas = paginarCapitulo(capituloCom({ tipo: 'texto', palavras: 900 }), 290);
    assert.equal(paginas.length, 1);
    assert.equal(paginas[0].blocos.length, 1);
  });

  test('capítulo curto continua sendo uma página só', () => {
    const paginas = paginarCapitulo(capituloCom({ tipo: 'texto', palavras: 80 }), 290);
    assert.equal(paginas.length, 1);
  });

  /** Capítulo vazio ainda precisa ser navegável, não sumir. */
  test('capítulo sem texto vira uma página em branco', () => {
    const paginas = paginarCapitulo(capituloCom(), 290);
    assert.equal(paginas.length, 1);
    assert.deepEqual(paginas[0].blocos, []);
  });
});
