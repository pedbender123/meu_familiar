import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREAS_DO_VENDEDOR, areaVisivel, ehVisao } from './visao-do-painel';

describe('o recorte do painel', () => {
  test('admin vê tudo', () => {
    for (const href of ['/painel/central', '/painel/pedidos', '/painel/saude', '/painel/equipe']) {
      assert.equal(areaVisivel(href, 'admin'), true, href);
    }
  });

  /**
   * A régua para uma área sobreviver: serve para decidir qual anúncio pausa
   * ou escala? Pedidos, cupons e saúde do fluxo não servem — são operação de
   * produto, e cada item a mais é um lugar para se perder e uma pergunta que
   * volta para o dono responder.
   */
  test('vendedor vê só o que decide anúncio', () => {
    assert.equal(areaVisivel('/painel/campanhas', 'vendedor'), true);
    assert.equal(areaVisivel('/painel/central', 'vendedor'), true);
    assert.equal(areaVisivel('/painel/midia', 'vendedor'), true);

    for (const href of [
      '/painel/pedidos',
      '/painel/cupons',
      '/painel/financeiro',
      '/painel/saude',
      '/painel/equipe',
      '/painel/assinantes',
      '/painel/remarketing',
    ]) {
      assert.equal(areaVisivel(href, 'vendedor'), false, `${href} não devia aparecer`);
    }
  });

  /** O funil de cada vídeo mora sob campanhas, e é o motivo de o vendedor abrir o painel. */
  test('as telas filhas de campanhas continuam visíveis', () => {
    assert.equal(areaVisivel('/painel/campanhas/abc', 'vendedor'), true);
    assert.equal(areaVisivel('/painel/campanhas/abc/peca/01', 'vendedor'), true);
  });

  /**
   * Um prefixo solto casaria `/painel/campanhas-secretas` com
   * `/painel/campanhas` — o tipo de vazamento que passa despercebido até
   * alguém criar a rota parecida.
   */
  test('prefixo parecido não passa', () => {
    assert.equal(areaVisivel('/painel/campanhas-internas', 'vendedor'), false);
    assert.equal(areaVisivel('/painel/centralzinha', 'vendedor'), false);
  });

  test('valor estranho no cookie não vira visão', () => {
    assert.equal(ehVisao('vendedor'), true);
    assert.equal(ehVisao('admin'), true);
    assert.equal(ehVisao('dono'), false);
    assert.equal(ehVisao(''), false);
    assert.equal(ehVisao(undefined), false);
  });

  test('a lista do vendedor não está vazia', () => {
    assert.ok(AREAS_DO_VENDEDOR.length > 0);
  });
});

describe('a troca de visão', () => {
  const fonte = readFileSync('src/app/painel/visao/route.ts', 'utf8');

  /**
   * Sem a checagem de caminho interno, `?voltar=https://outro-site` faria o
   * painel mandar alguém para fora achando que continua aqui.
   */
  test('não redireciona para fora', () => {
    assert.match(fonte, /startsWith\('\/painel\/'\)/);
    assert.match(fonte, /!voltar\.startsWith\('\/\/'\)/);
  });

  test('não grava a visão de quem não está no painel', () => {
    const antesDoCookie = fonte.slice(0, fonte.indexOf('resposta.cookies.set'));
    assert.match(antesDoCookie, /sessao\.tipo !== 'admin'/);
  });

  /** Voltar para uma tela que o recorte novo esconde é estrear o modo quebrado. */
  test('o destino é conferido contra o recorte novo', () => {
    assert.match(fonte, /areaVisivel\(voltar!, para\)/);
  });
});

describe('o relatório da campanha', () => {
  const fonte = readFileSync('src/lib/campanhas.ts', 'utf8');

  /**
   * A campanha nasceu como "janela de tempo", e o relatório dela somava quem
   * digitou o endereço, quem veio da bio e quem clicou no anúncio. Isso
   * empurra a conversão medida para baixo e faz o CPA parecer pior do que é —
   * e é com esse número que alguém decide escalar ou pausar.
   */
  test('conta só quem chegou marcado com a campanha', () => {
    assert.match(fonte, /const soDaCampanha = campanhaId/);
    // Toda consulta do relatório precisa respeitar o filtro; uma que escape
    // devolveria um número inflado no meio de números corretos, que é a
    // forma mais difícil de perceber um erro.
    const usos = fonte.match(/\$\{soDaCampanha\}/g) ?? [];
    assert.ok(usos.length >= 7, `só ${usos.length} consultas filtram pela campanha`);
  });

  /**
   * Quem clica hoje, volta amanhã digitando o endereço e só então compra: a
   * segunda visita não carrega marcação, mas o pedido carrega, herdado do
   * cookie de atribuição. Contar só pelas visitas perderia justamente a venda
   * de quem pensou antes de comprar.
   */
  test('o pedido também prova pertencimento, não só a visita', () => {
    const bloco = fonte.slice(fonte.indexOf('const soDaCampanha'), fonte.indexOf('const visitasLinhas'));
    assert.match(bloco, /FROM visitas/);
    assert.match(bloco, /UNION/);
    assert.match(bloco, /FROM pedidos/);
  });

  test('a Central continua vendo tudo', () => {
    const central = readFileSync('src/app/painel/central/page.tsx', 'utf8');
    assert.match(central, /relatorioDoPeriodo\(periodo\.de, periodo\.ate, gran\.minutos\)/);
  });
});
