import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESCOLHA_DE_FUNIL_LIGADA,
  FUNIL_PADRAO,
  FUNIS,
  funilPorCodigo,
  funisDaCampanha,
  sortearEntre,
} from './funis';

/**
 * A escolha de funil está desligada, e este arquivo é a trava disso.
 *
 * O teste A/B existia e não provou nada: só as 26 cenas venderam. Enquanto
 * `ESCOLHA_DE_FUNIL_LIGADA` for `false`, toda campanha serve as 26 cenas — e
 * o que quebra essa promessa é justamente o caso silencioso: uma campanha
 * antiga com `atravessar` gravado na coluna continuar servindo `atravessar`
 * para tráfego pago sem ninguém perceber.
 */
describe('com a escolha desligada', () => {
  test('campanha nenhuma escapa das 26 cenas', () => {
    assert.equal(ESCOLHA_DE_FUNIL_LIGADA, false);
    assert.deepEqual(funisDaCampanha(null), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('["atravessar"]'), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('["atravessar","familiar"]'), [FUNIL_PADRAO]);
    assert.deepEqual(funisDaCampanha('lixo que não é json'), [FUNIL_PADRAO]);
  });

  test('sortear entre os inativos cai no padrão', () => {
    assert.equal(sortearEntre(['atravessar', 'familiar']), FUNIL_PADRAO);
    assert.equal(sortearEntre([]), FUNIL_PADRAO);
  });

  test('só as 26 cenas estão ativas', () => {
    const ativos = Object.values(FUNIS).filter((f) => f.ativo).map((f) => f.id);
    assert.deepEqual(ativos, [FUNIL_PADRAO]);
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

  test('as outras portas de funil caem na página de vendas', () => {
    const config = readFileSync('next.config.ts', 'utf8');
    for (const rota of ['/atravessar', '/familiar']) {
      const trecho = config.slice(config.indexOf(`source: "${rota}"`));
      assert.match(trecho.slice(0, 120), /destination: "\/vendas"/, rota);
    }
  });
});
