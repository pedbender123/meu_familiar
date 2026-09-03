import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FUNIL_PADRAO,
  FUNIS,
  caminhoDoFunil,
  funilPorCodigo,
  funisDaCampanha,
  linkDaCampanha,
  sortearEntre,
} from './funis';

/**
 * O funil de uma campanha vem do que ela guardou; sem nada guardado, as 26
 * cenas. É o único jeito de uma campanha antiga — criada antes de a coluna
 * existir — continuar servindo o que sempre serviu.
 */
describe('o funil da campanha', () => {
  test('sem nada guardado, as 26 cenas', () => {
    assert.deepEqual(funisDaCampanha(null), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('lixo que não é json'), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('["inventado"]'), [FUNIL_PADRAO]);
  });

  test('o que ela guardou é o que ela serve', () => {
    assert.deepEqual(funisDaCampanha('["familiar"]'), ['familiar']);
    assert.deepEqual(funisDaCampanha('["atravessar"]'), ['atravessar']);
  });

  test('sortear entre uma lista vazia cai no padrão', () => {
    assert.equal(sortearEntre([]), FUNIL_PADRAO);
  });

  test('os três estão ativos', () => {
    const ativos = Object.values(FUNIS).filter((f) => f.ativo).map((f) => f.id);
    assert.deepEqual(ativos.sort(), ['atravessar', 'familiar', 'padrao']);
  });
});

/**
 * O link publicável — o que o painel entrega pronto para colar no anúncio.
 *
 * É aqui que o teste de funil deixa de ser teoria: sem um endereço próprio, a
 * única forma de mandar tráfego para outra aposta seria trocar o que a raiz
 * serve para todo mundo.
 */
describe('o link da campanha', () => {
  test('as 26 cenas ficam na raiz, sem barra sobrando', () => {
    assert.equal(caminhoDoFunil('padrao'), '/');
    assert.equal(
      linkDaCampanha('https://bruxario.com.br', 'padrao', 'a5'),
      'https://bruxario.com.br?c=a5'
    );
  });

  test('cada aposta tem o endereço dela', () => {
    assert.equal(
      linkDaCampanha('https://bruxario.com.br', 'familiar', 'a5'),
      'https://bruxario.com.br/familiar?c=a5'
    );
    assert.equal(
      linkDaCampanha('https://bruxario.com.br', 'atravessar', 'a6'),
      'https://bruxario.com.br/atravessar?c=a6'
    );
  });

  test('a barra do fim da base não vira barra dupla', () => {
    assert.equal(
      linkDaCampanha('https://bruxario.com.br/', 'familiar', 'a5'),
      'https://bruxario.com.br/familiar?c=a5'
    );
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

/**
 * A página de vendas é o endereço que está nos criativos. O que ela mostra
 * mudou; o endereço, não.
 *
 * Este teste existe porque o erro é silencioso e caro: se `/vendas` voltar a
 * renderizar outro funil — ou a redirecionar para a raiz, que sem marcador é a
 * landing explicativa —, todo tráfego pago passa a bater numa página que
 * conta os doze familiares e mostra a tabela de planos antes da primeira
 * pergunta. Ninguém percebe olhando a tela; percebe-se na conversão, semanas
 * depois.
 */
describe('a página de vendas', () => {
  test('renderiza as 26 cenas, e não a landing', () => {
    const fonte = readFileSync('src/app/vendas/page.tsx', 'utf8');
    assert.match(fonte, /PortaDoRitual/);
    assert.doesNotMatch(fonte, /redirect\(/);
  });

  test('não sobrou redirecionamento de /vendas na configuração', () => {
    const config = readFileSync('next.config.ts', 'utf8');
    assert.doesNotMatch(
      config,
      /source:\s*["']\/vendas["']/,
      '/vendas é uma página, não um desvio'
    );
  });

  /**
   * O oposto do que este teste dizia hoje de manhã.
   *
   * `/atravessar` e `/familiar` chegaram a redirecionar para `/vendas`. Isso
   * matava a única forma de testar um funil com tráfego isolado — que é
   * exatamente o que eles existem para permitir. Endereço próprio é o
   * mecanismo, não o problema; o que não pode é tráfego pago cair neles sem
   * querer, e disso cuida não haver link nenhum apontando para lá.
   */
  test('as portas de funil continuam sendo páginas, não desvios', () => {
    const config = readFileSync('next.config.ts', 'utf8');
    for (const rota of ['/atravessar', '/familiar']) {
      assert.doesNotMatch(
        config,
        new RegExp(`source:\\s*["']${rota}["']`),
        `${rota} é o link isolado de um funil — redirecionar mata o teste`
      );
    }
  });
});
