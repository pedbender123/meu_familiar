import test, { describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db from '../lib/db';
import '../lib/autenticacao';
import { resumoDeAssinantes, assinantesAtivos } from './assinantes';

/**
 * Planos próprios, com preços fictícios e redondos.
 *
 * Fixar em plano comercial já quebrou testes três vezes neste repositório. O
 * que se verifica aqui é a ARITMÉTICA do MRR — que anual entra dividido por
 * doze, que gratuito não soma, que churn não divide por zero — e nada disso
 * depende de quanto custa a Vigília hoje.
 */
const MENSAL = 'teste_ass_mensal';
const ANUAL = 'teste_ass_anual';
const GRATIS = 'teste_ass_gratis';

function semearPlanos() {
  const agora = new Date().toISOString();
  const inserir = db.prepare(
    `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
       parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
     VALUES (@id, @nome, @preco, @dias, 1, 1, 0, '{}', 1, @agora, @agora)
     ON CONFLICT(id) DO UPDATE SET preco_centavos = @preco, duracao_dias = @dias`
  );
  inserir.run({ id: MENSAL, nome: 'Mensal de teste', preco: 3000, dias: 30, agora });
  // 36000 no ano = exatamente 3000 por mês. Escolhido para o teste de
  // normalização não depender de arredondamento.
  inserir.run({ id: ANUAL, nome: 'Anual de teste', preco: 36000, dias: 365, agora });
  inserir.run({ id: GRATIS, nome: 'Grátis de teste', preco: 0, dias: null, agora });
}

function conta(): string {
  const id = randomUUID();
  db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(
    id,
    `${id}@bruxario.local`,
    new Date().toISOString()
  );
  return id;
}

function assinar(planoId: string, opcoes: { inicio?: Date; fim?: Date | null; status?: string } = {}) {
  const agora = new Date();
  const inicio = opcoes.inicio ?? agora;
  const fim =
    opcoes.fim === null
      ? null
      : (opcoes.fim ?? new Date(agora.getTime() + 20 * 86_400_000));
  db.prepare(
    `INSERT INTO assinaturas (id, conta_id, plano_id, status, inicio, fim,
       renovacao_automatica, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    randomUUID(),
    conta(),
    planoId,
    opcoes.status ?? 'ativa',
    inicio.toISOString(),
    fim ? fim.toISOString() : null,
    agora.toISOString(),
    agora.toISOString()
  );
}

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM cobrancas');
  db.exec('DELETE FROM contas');
  semearPlanos();
});

after(() => {
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
  db.prepare("DELETE FROM planos WHERE id LIKE 'teste_ass_%'").run();
});

describe('MRR', () => {
  test('mensal entra pelo preço cheio', () => {
    assinar(MENSAL);
    assert.equal(resumoDeAssinantes().mrrCentavos, 3000);
  });

  /**
   * O erro clássico de painel de SaaS: somar a venda anual inteira no mês em
   * que ela caiu, e comemorar um mês que não vai se repetir.
   */
  test('anual entra dividido por doze, não inteiro no mês da venda', () => {
    assinar(ANUAL, { fim: new Date(Date.now() + 300 * 86_400_000) });
    const r = resumoDeAssinantes();
    assert.equal(r.mrrCentavos, 3000, 'R$ 360/ano tem que virar R$ 30/mês');
    assert.notEqual(r.mrrCentavos, 36000);
  });

  test('gratuito não soma receita, mas é contado à parte', () => {
    assinar(GRATIS, { fim: null });
    const r = resumoDeAssinantes();
    assert.equal(r.mrrCentavos, 0);
    assert.equal(r.pagantes, 0);
    assert.equal(r.gratuitos, 1);
  });

  test('mistura: dois mensais, um anual e um grátis', () => {
    assinar(MENSAL);
    assinar(MENSAL);
    assinar(ANUAL, { fim: new Date(Date.now() + 300 * 86_400_000) });
    assinar(GRATIS, { fim: null });

    const r = resumoDeAssinantes();
    assert.equal(r.mrrCentavos, 9000, '3000 + 3000 + 3000');
    assert.equal(r.pagantes, 3);
    assert.equal(r.gratuitos, 1);
    assert.equal(r.ticketMedioCentavos, 3000);
  });
});

describe('quem conta como ativo', () => {
  /**
   * A data manda, não o `status`. O status é mantido por cron, e cron pode
   * estar parado — o painel precisa contar quem está entrando de verdade,
   * que é a mesma regra que libera o acesso.
   */
  test('assinatura com fim no passado não entra, mesmo marcada como ativa', () => {
    assinar(MENSAL, {
      inicio: new Date(Date.now() - 60 * 86_400_000),
      fim: new Date(Date.now() - 86_400_000),
      status: 'ativa',
    });
    assert.equal(assinantesAtivos().length, 0);
    assert.equal(resumoDeAssinantes().mrrCentavos, 0);
  });

  test('cancelada não entra nem dentro do prazo', () => {
    assinar(MENSAL, { status: 'cancelada' });
    assert.equal(assinantesAtivos().length, 0);
  });

  test('sem fim (vitalícia) entra', () => {
    assinar(MENSAL, { fim: null });
    assert.equal(assinantesAtivos().length, 1);
  });
});

describe('vencendo', () => {
  test('aparece quem vence dentro de 7 dias', () => {
    assinar(MENSAL, { fim: new Date(Date.now() + 3 * 86_400_000) });
    const r = resumoDeAssinantes();
    assert.equal(r.vencendo.length, 1);
    assert.equal(r.vencendo[0].diasRestantes, 3);
  });

  test('não aparece quem vence depois', () => {
    assinar(MENSAL, { fim: new Date(Date.now() + 20 * 86_400_000) });
    assert.equal(resumoDeAssinantes().vencendo.length, 0);
  });

  test('grátis nunca aparece como vencendo — não há o que renovar', () => {
    assinar(GRATIS, { fim: new Date(Date.now() + 2 * 86_400_000) });
    assert.equal(resumoDeAssinantes().vencendo.length, 0);
  });
});

describe('churn', () => {
  /**
   * Mês de estreia com zero no começo produziria "100% de churn" — o número
   * mais enganoso que um painel de SaaS pode mostrar.
   */
  test('sem ninguém no início do mês, churn é null e não 100%', () => {
    assinar(MENSAL);
    assert.equal(resumoDeAssinantes().churnMes, null);
  });

  test('conta os perdidos do mês pelo fim do acesso', () => {
    const inicioDoMes = new Date();
    inicioDoMes.setDate(2);
    inicioDoMes.setHours(0, 0, 0, 0);

    // Um veio de antes e continua; um veio de antes e caiu neste mês.
    assinar(MENSAL, { inicio: new Date(Date.now() - 90 * 86_400_000) });
    assinar(MENSAL, {
      inicio: new Date(Date.now() - 90 * 86_400_000),
      fim: inicioDoMes,
      status: 'expirada',
    });

    const r = resumoDeAssinantes();
    assert.equal(r.perdidosNoMes, 1);
    assert.equal(r.novosNoMes, 0);
    assert.equal(r.churnMes, 0.5, '1 perdido de 2 que existiam no começo');
  });
});
