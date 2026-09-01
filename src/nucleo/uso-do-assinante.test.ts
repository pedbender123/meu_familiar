import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from '../lib/db';
import { usoDasContas, resumoDeUso } from './uso-do-assinante';

/**
 * O que acontece depois da compra.
 *
 * Quem compra um PDF e some já pagou. Quem assina e some cancela no mês
 * seguinte — e o cancelamento chega trinta dias depois de a decisão ter sido
 * tomada. Estes testes cobrem os sinais que aparecem antes disso.
 */

const AGORA = new Date('2026-09-15T12:00:00.000Z');

beforeEach(() => {
  db.exec('DELETE FROM contas');
  db.exec('DELETE FROM cobrancas');
  db.exec('DELETE FROM leituras');
});

function conta(id: string, ultimoAcesso: string | null) {
  db.prepare(
    `INSERT INTO contas (id, email, criado_em, ultimo_acesso_em)
     VALUES (?, ?, '2026-08-01T00:00:00.000Z', ?)`
  ).run(id, `${id}@exemplo.com`, ultimoAcesso);
}

function cobrar(id: string, contaId: string, acessoEnviadoEm: string | null) {
  db.prepare(
    `INSERT INTO cobrancas (id, conta_id, email, plano_id, valor_centavos, status,
       acesso_enviado_em, criado_em, atualizado_em)
     VALUES (?, ?, 'x@y.z', 'mensal', 2990, 'pago', ?,
       '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')`
  ).run(id, contaId, acessoEnviadoEm);
}

function usar(contaId: string, tipo: string, quando: string, custo: number) {
  db.prepare(
    `INSERT INTO leituras (id, conta_id, tipo, pergunta, semente, resposta_json,
       custo_centavos, criado_em)
     VALUES (?, ?, ?, 'p', 's', '{}', ?, ?)`
  ).run(`l-${contaId}-${quando}-${tipo}`, contaId, tipo, custo, quando);
}

describe('o uso de cada assinante', () => {
  test('conta consultas, leituras e custo separando o mês corrente', () => {
    conta('c1', '2026-09-14T10:00:00.000Z');
    usar('c1', 'mensagem', '2026-08-20T10:00:00.000Z', 30);
    usar('c1', 'mensagem', '2026-09-10T10:00:00.000Z', 40);
    usar('c1', 'leitura', '2026-09-12T10:00:00.000Z', 200);

    const u = usoDasContas(['c1'], AGORA).get('c1')!;
    assert.equal(u.consultas, 2);
    assert.equal(u.leituras, 1);
    assert.equal(u.custoIaCentavos, 270);
    assert.equal(u.custoIaNoMesCentavos, 240, 'agosto fica de fora do mês corrente');
    assert.equal(u.ultimoUsoEm, '2026-09-12T10:00:00.000Z');
  });

  /**
   * Três estados diferentes, e a diferença é o que se faz: chave que não saiu
   * se reenvia; chave que saiu e ninguém abriu é caixa de spam; quem entrou
   * tem data.
   */
  test('separa quem não recebeu a chave de quem recebeu e não entrou', () => {
    conta('semChave', null);
    cobrar('cob1', 'semChave', null);
    conta('naoEntrou', null);
    cobrar('cob2', 'naoEntrou', '2026-09-01T00:00:00.000Z');
    conta('entrou', '2026-09-10T00:00:00.000Z');
    cobrar('cob3', 'entrou', '2026-09-01T00:00:00.000Z');

    const m = usoDasContas(['semChave', 'naoEntrou', 'entrou'], AGORA);
    assert.equal(m.get('semChave')!.acessoEnviadoEm, null);
    assert.equal(m.get('naoEntrou')!.acessoEnviadoEm, '2026-09-01T00:00:00.000Z');
    assert.equal(m.get('naoEntrou')!.ultimoAcessoEm, null);
    assert.equal(m.get('entrou')!.ultimoAcessoEm, '2026-09-10T00:00:00.000Z');
  });

  /**
   * Quem assinou, saiu e voltou tem duas entregas. A que responde "está com o
   * acesso?" é a última.
   */
  test('vale a entrega mais recente da conta', () => {
    conta('c1', null);
    cobrar('velha', 'c1', '2026-03-01T00:00:00.000Z');
    cobrar('nova', 'c1', '2026-09-01T00:00:00.000Z');
    assert.equal(
      usoDasContas(['c1'], AGORA).get('c1')!.acessoEnviadoEm,
      '2026-09-01T00:00:00.000Z'
    );
  });

  /** Conta sem uso nenhum precisa existir no mapa, zerada, não sumir dele. */
  test('quem nunca usou aparece com zero, não desaparece', () => {
    conta('c1', null);
    const u = usoDasContas(['c1'], AGORA).get('c1');
    assert.ok(u, 'a linha existe');
    assert.equal(u.consultas, 0);
    assert.equal(u.custoIaCentavos, 0);
  });

  test('lista vazia não vira consulta', () => {
    assert.equal(usoDasContas([], AGORA).size, 0);
  });
});

describe('os sinais de que alguém está saindo', () => {
  function usos() {
    conta('nunca', null);
    conta('semUso', '2026-09-14T00:00:00.000Z');
    conta('sumido', '2026-09-14T00:00:00.000Z');
    usar('sumido', 'mensagem', '2026-08-20T00:00:00.000Z', 10);
    conta('ativo', '2026-09-14T00:00:00.000Z');
    usar('ativo', 'mensagem', '2026-09-14T00:00:00.000Z', 50);
    return [...usoDasContas(['nunca', 'semUso', 'sumido', 'ativo'], AGORA).values()];
  }

  test('cada pessoa cai num estado só', () => {
    const r = resumoDeUso(usos(), AGORA);
    assert.equal(r.nuncaEntraram, 1);
    assert.equal(r.entraramENaoUsaram, 1);
    assert.equal(r.sumidos, 1, 'usou, mas há mais de 14 dias');
  });

  /**
   * O custo do mês é o número que se compara com a mensalidade. O maior
   * isolado importa porque a média esconde o caso que dá prejuízo.
   */
  test('soma o custo do mês e guarda o maior isolado', () => {
    const r = resumoDeUso(usos(), AGORA);
    assert.equal(r.custoIaNoMesCentavos, 50, 'agosto não entra');
    assert.equal(r.maiorCustoNoMesCentavos, 50);
  });
});
