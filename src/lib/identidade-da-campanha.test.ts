import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import { idDaMeta, chaveDeUtm, campanhaDoUtm, pecaDoUtm } from './campanhas';

/**
 * Uma campanha da Meta é UMA campanha, venha o `utm_campaign` como vier.
 *
 * ── O estado do banco em 01/09 ────────────────────────────────────────────
 *
 * Quatro campanhas reais, **sete identidades** chegando. Três das quatro
 * apareciam em dois formatos ao mesmo tempo — o ID puro e o nome colado na
 * frente dele:
 *
 *     120250071056090615
 *     1-1-1 - Aberto - ABO - 24/08/2026|120250071056090615
 *
 * Para nós, duas campanhas. Para a UTMify, duas linhas de relatório — cada
 * uma com metade das vendas e metade do investimento, e nenhuma das duas
 * fechando a conta sozinha.
 */

/** Os valores exatos que chegaram em produção. */
const REAIS = [
  '120250071056090615',
  '1-1-1 - Aberto - ABO - 24/08/2026|120250071056090615',
  '120250203900740615',
  'Bitcap 01//09|120250203900740615',
  '120250202476680615',
  '1-6-1 - Aberto - ABO - 31/08/2026  P2|120250202476680615',
  '120248890724340044',
];

beforeEach(() => {
  db.exec('DELETE FROM campanhas');
  db.exec('DELETE FROM pecas');
});

describe('o ID da Meta, venha como vier', () => {
  test('acha o ID com o nome colado na frente', () => {
    assert.equal(
      idDaMeta('1-1-1 - Aberto - ABO - 24/08/2026|120250071056090615'),
      '120250071056090615'
    );
    assert.equal(idDaMeta('Bitcap 01//09|120250203900740615'), '120250203900740615');
    assert.equal(idDaMeta('120248890724340044'), '120248890724340044');
  });

  /**
   * Quinze dígitos é a régua. Nenhum código humano tem tantos números
   * seguidos por acaso, e os IDs da Meta têm dezessete.
   */
  test('não confunde número curto com ID', () => {
    assert.equal(idDaMeta('promo-2026'), null);
    assert.equal(idDaMeta('blackfriday10'), null);
    assert.equal(idDaMeta('24/08/2026'), null);
    assert.equal(idDaMeta(null), null);
  });

  test('a data no nome não é confundida com o ID', () => {
    // "1-1-1 - Aberto - ABO - 24/08/2026" tem números, e nenhum deles é o ID.
    assert.equal(idDaMeta('1-1-1 - Aberto - ABO - 24/08/2026'), null);
  });
});

describe('as sete identidades viram quatro campanhas', () => {
  test('formatos diferentes do mesmo anúncio dão a mesma chave', () => {
    assert.equal(
      chaveDeUtm('1-1-1 - Aberto - ABO - 24/08/2026|120250071056090615'),
      chaveDeUtm('120250071056090615')
    );
  });

  /** O teste que reproduz o banco inteiro daquele dia. */
  test('os sete valores reais criam quatro campanhas, não sete', () => {
    const ids = new Set<string>();
    for (const bruto of REAIS) {
      const c = campanhaDoUtm(bruto, 'instagram');
      assert.ok(c, `"${bruto}" precisava virar campanha`);
      ids.add(c.id);
    }
    assert.equal(ids.size, 4, 'quatro campanhas da Meta, quatro campanhas aqui');
    assert.equal(
      (db.prepare('SELECT COUNT(*) c FROM campanhas').get() as { c: number }).c,
      4
    );
  });

  /** A chave guardada é o ID cru — é ele que a UTMify conhece. */
  test('a campanha nasce chaveada pelo ID, não pelo nome', () => {
    const c = campanhaDoUtm('Bitcap 01//09|120250203900740615', 'instagram')!;
    assert.equal(c.utm_campanha, '120250203900740615');
  });

  /** Sem ID nenhum, o texto continua valendo — quem escreve UTM à mão existe. */
  test('UTM escrito à mão continua criando campanha pelo texto', () => {
    const c = campanhaDoUtm('promo-agosto', 'instagram');
    assert.equal(c?.utm_campanha, 'promo-agosto');
  });
});

describe('o conjunto de anúncios, onde quer que ele venha', () => {
  /**
   * A recomendação é `utm_term={{adset.id}}`. Em 01/09 a agência estava
   * mandando o conjunto em `utm_medium` e o POSICIONAMENTO em `utm_term`.
   *
   * Lendo só `utm_term`, o painel agruparia os criativos por "Threads_Feed"
   * achando que isso é um conjunto — e o conjunto real, que é onde o
   * orçamento é decidido, não apareceria em lugar nenhum.
   */
  test('acha o conjunto no utm_medium quando o utm_term traz posicionamento', () => {
    const campanha = campanhaDoUtm('120250071056090615', 'instagram')!;
    const peca = pecaDoUtm(
      campanha.id,
      'AD 01|120250071056080615',
      'Threads_Feed',
      'CJ 01|120250071056070615'
    );
    assert.equal(peca?.utm_conteudo, '120250071056080615', 'o criativo é o ad.id');
    assert.equal(peca?.utm_conjunto, '120250071056070615', 'o conjunto é o adset.id');
  });

  test('com o utm_term correto, ele é usado', () => {
    const campanha = campanhaDoUtm('120250071056090615', 'instagram')!;
    const peca = pecaDoUtm(campanha.id, '120250071056080615', '120250071056070615');
    assert.equal(peca?.utm_conjunto, '120250071056070615');
  });

  /** Sem ID em lugar nenhum, o texto do primeiro campo ainda serve. */
  test('sem ID, cai para o texto', () => {
    const campanha = campanhaDoUtm('promo-agosto', 'instagram')!;
    const peca = pecaDoUtm(campanha.id, 'video-1', 'publico-frio');
    assert.equal(peca?.utm_conjunto, 'publico-frio');
  });
});
