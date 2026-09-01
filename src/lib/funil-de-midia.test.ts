import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import { campanhaDoUtm, criarPeca, funilDeMidia, listarPecas, pecaDoUtm } from './campanhas';

beforeEach(() => {
  db.exec('DELETE FROM pecas');
  db.exec('DELETE FROM campanhas');
});

const CAMPANHA = '120250203900740615';
const CONJUNTO_A = '120250203900760001';
const CONJUNTO_B = '120250203900760002';

describe('o teto de peças, que a escala encontra', () => {
  /**
   * O código de dois dígitos existe para caber na URL curta `?c=ab01`, e isso
   * dá 99 peças por campanha. Enquanto cada peça era um vídeo cadastrado à
   * mão, 99 era um teto que ninguém alcançava.
   *
   * Deixou de ser: a peça virou o ANÚNCIO, e uma conta escalando passa de 99
   * anúncios numa campanha sem esforço. Da 100ª em diante o tráfego perdia o
   * criativo **em silêncio** — as vendas continuavam chegando, atribuídas à
   * campanha, e a dash por vídeo simplesmente parava de crescer.
   */
  test('a peça 100 nasce, em vez de falhar', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    for (let i = 0; i < 99; i++) {
      const r = criarPeca({ campanha_id: c.id, nome: `anuncio ${i}` });
      assert.equal(r.ok, true, `a ${i + 1}ª devia ter nascido`);
    }
    const centesima = criarPeca({ campanha_id: c.id, nome: 'anuncio 100' });
    assert.equal(centesima.ok, true, 'a 100ª peça precisa nascer');
    assert.equal(listarPecas(c.id).length, 100);
  });

  test('e o código dela não colide com os dois dígitos', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    for (let i = 0; i < 100; i++) criarPeca({ campanha_id: c.id, nome: `a${i}` });
    const codigos = listarPecas(c.id).map((p) => p.codigo);
    assert.equal(new Set(codigos).size, codigos.length, 'código repetido');
  });

  /** E o tráfego de anúncio continua ganhando peça depois do centésimo. */
  test('pecaDoUtm não devolve vazio depois de 99', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    for (let i = 0; i < 99; i++) criarPeca({ campanha_id: c.id, nome: `a${i}` });
    const p = pecaDoUtm(c.id, '120250203900750999', CONJUNTO_A);
    assert.ok(p, 'anúncio 100 perdeu a atribuição de criativo');
    assert.equal(p.utm_conjunto, CONJUNTO_A);
  });
});

describe('o conjunto de anúncios', () => {
  test('é guardado quando a peça nasce', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    const p = pecaDoUtm(c.id, '111111111111', CONJUNTO_A);
    assert.equal(p?.utm_conjunto, CONJUNTO_A);
  });

  /**
   * Peças criadas antes desta coluna, e anúncios cujo primeiro clique veio sem
   * `utm_term`, ganham o conjunto na primeira visita que o trouxer.
   */
  test('preenche depois, quando ainda não havia', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    pecaDoUtm(c.id, '111111111111', null);
    const depois = pecaDoUtm(c.id, '111111111111', CONJUNTO_A);
    assert.equal(depois?.utm_conjunto, CONJUNTO_A);
  });

  /**
   * Mas nunca troca: anúncio não muda de conjunto, e se mudasse, sobrescrever
   * apagaria de onde as vendas anteriores vieram.
   */
  test('não sobrescreve o conjunto já conhecido', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    pecaDoUtm(c.id, '111111111111', CONJUNTO_A);
    const depois = pecaDoUtm(c.id, '111111111111', CONJUNTO_B);
    assert.equal(depois?.utm_conjunto, CONJUNTO_A);
  });
});

describe('os três degraus', () => {
  test('campanha vem primeiro, conjuntos depois, criativos por último', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    pecaDoUtm(c.id, '111111111111', CONJUNTO_A);
    pecaDoUtm(c.id, '222222222222', CONJUNTO_A);
    pecaDoUtm(c.id, '333333333333', CONJUNTO_B);

    const linhas = funilDeMidia(c.id);
    assert.equal(linhas[0].nivel, 'campanha');
    assert.equal(linhas[0].idDaMeta, CAMPANHA);

    const conjuntos = linhas.filter((l) => l.nivel === 'conjunto');
    const criativos = linhas.filter((l) => l.nivel === 'criativo');
    assert.equal(conjuntos.length, 2, 'dois conjuntos');
    assert.equal(criativos.length, 3, 'três anúncios');
  });

  /**
   * Peça sem conjunto cai num balde próprio e não se mistura ao primeiro que
   * aparecer — é tráfego real, e o rótulo precisa dizer o que é.
   */
  test('quem não tem conjunto não é somado a um conjunto alheio', () => {
    const c = campanhaDoUtm(CAMPANHA)!;
    pecaDoUtm(c.id, '111111111111', CONJUNTO_A);
    pecaDoUtm(c.id, '222222222222', null);

    const conjuntos = funilDeMidia(c.id).filter((l) => l.nivel === 'conjunto');
    assert.equal(conjuntos.length, 2);
    assert.ok(conjuntos.some((x) => x.id === '(sem conjunto)'));
    assert.ok(conjuntos.some((x) => x.idDaMeta === CONJUNTO_A));
  });

  test('campanha que não existe devolve vazio, sem estourar', () => {
    assert.deepEqual(funilDeMidia('nao-existe'), []);
  });
});
