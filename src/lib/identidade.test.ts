import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db from './db';
import {
  anotarIdentidade,
  virouLead,
  identidadeDoVisitante,
  identidadeDoEmail,
  fbcDeFbclid,
} from './identidade';

/**
 * O tracker existe porque o navegador contou três vendas para um pagamento.
 * Estes testes travam as decisões que impedem isso de voltar.
 */

beforeEach(() => {
  db.exec('DELETE FROM identidades');
});

describe('a chegada', () => {
  test('guarda a URL completa, com a query inteira', () => {
    const v = randomUUID();
    const url = 'https://bruxario.com.br/?c=a1&p=03&fbclid=XYZ';
    anotarIdentidade({ visitante: v, urlEntrada: url });
    assert.equal(identidadeDoVisitante(v)?.url_entrada, url);
  });

  /**
   * A chegada aconteceu UMA vez. Sobrescrever na segunda página apagaria o
   * link do anúncio e deixaria a navegação interna no lugar — era assim que a
   * origem de campanha se perdia.
   */
  test('a segunda página não apaga a URL de entrada', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, urlEntrada: 'https://bruxario.com.br/?c=a1' });
    anotarIdentidade({ visitante: v, urlEntrada: 'https://bruxario.com.br/ritual' });
    assert.equal(identidadeDoVisitante(v)?.url_entrada, 'https://bruxario.com.br/?c=a1');
  });

  test('o referer da chegada também não é sobrescrito', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, referer: 'https://l.instagram.com/' });
    anotarIdentidade({ visitante: v, referer: 'https://bruxario.com.br/ritual' });
    assert.equal(identidadeDoVisitante(v)?.referer, 'https://l.instagram.com/');
  });

  /**
   * `_fbp` só existe depois que o pixel roda — na primeira visita costuma vir
   * nulo e aparecer na segunda. Se ele seguisse a regra do "primeiro vence",
   * ficaria nulo para sempre e a atribuição morreria junto.
   */
  test('o _fbp que aparece depois é gravado', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, fbp: null });
    anotarIdentidade({ visitante: v, fbp: 'fb.1.123.456' });
    assert.equal(identidadeDoVisitante(v)?.fbp, 'fb.1.123.456');
  });

  test('mas um _fbp ausente depois não apaga o que já havia', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, fbp: 'fb.1.123.456' });
    anotarIdentidade({ visitante: v, fbp: null });
    assert.equal(identidadeDoVisitante(v)?.fbp, 'fb.1.123.456');
  });
});

describe('fbclid quando o pixel está bloqueado', () => {
  test('vira _fbc no formato da Meta', () => {
    const montado = fbcDeFbclid('ABC123', new Date(1_700_000_000_000));
    assert.equal(montado, 'fb.1.1700000000000.ABC123');
  });

  test('sem cookie _fbc, o fbclid da URL preenche o lugar', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, fbclid: 'ABC123' });
    const i = identidadeDoVisitante(v)!;
    assert.equal(i.fbclid, 'ABC123');
    assert.ok(i.fbc?.startsWith('fb.1.'), 'monta o _fbc a partir do fbclid');
    assert.ok(i.fbc?.endsWith('.ABC123'));
  });

  test('o cookie _fbc de verdade tem prioridade sobre o montado', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, fbc: 'fb.1.999.REAL', fbclid: 'ABC123' });
    assert.equal(identidadeDoVisitante(v)?.fbc, 'fb.1.999.REAL');
  });
});

describe('virar lead', () => {
  test('o visitante anônimo ganha dono', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v, fbp: 'fb.1.1.1' });
    virouLead(v, 'Pessoa@Exemplo.COM');

    const i = identidadeDoVisitante(v)!;
    assert.equal(i.email, 'pessoa@exemplo.com', 'normaliza o e-mail');
    assert.ok(i.virou_lead_em);
  });

  test('virar lead de novo não move a data — ela aconteceu uma vez', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v });
    virouLead(v, 'a@b.com');
    const primeira = identidadeDoVisitante(v)!.virou_lead_em;
    virouLead(v, 'a@b.com');
    assert.equal(identidadeDoVisitante(v)!.virou_lead_em, primeira);
  });
});

describe('achar a identidade pelo e-mail', () => {
  /**
   * É isto que o webhook usa, horas depois, sem navegador nenhum por perto.
   * Uma pessoa tem vários visitantes (celular, computador, aba anônima) — e a
   * que serve é a que tem `fbp`, porque sem ele a Meta não liga a venda ao
   * anúncio.
   */
  test('prefere o visitante que tem _fbp, mesmo sendo mais antigo', () => {
    const semFbp = randomUUID();
    const comFbp = randomUUID();

    anotarIdentidade({ visitante: comFbp, fbp: 'fb.1.1.1' });
    virouLead(comFbp, 'a@b.com');

    anotarIdentidade({ visitante: semFbp });
    virouLead(semFbp, 'a@b.com');

    assert.equal(identidadeDoEmail('a@b.com')?.visitante, comFbp);
  });

  test('e-mail sem identidade devolve undefined em vez de explodir', () => {
    assert.equal(identidadeDoEmail('ninguem@exemplo.com'), undefined);
  });

  test('e-mail vazio não varre a tabela inteira', () => {
    const v = randomUUID();
    anotarIdentidade({ visitante: v });
    virouLead(v, 'a@b.com');
    assert.equal(identidadeDoEmail('  '), undefined);
  });
});
