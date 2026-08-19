import test, { describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db from '../lib/db';
import '../lib/autenticacao';
import { leiturasParadas, DIAS_DE_ESPERA } from './leitura-parada';

/**
 * Cinco filtros, e cada um é uma decisão sobre para quem NÃO mandar.
 *
 * Remarketing para a pessoa errada não é ineficiente — é o começo de uma
 * reputação de spam que derruba junto os e-mails que as pessoas esperam (o
 * acesso, a revelação). Por isso cada filtro tem teste próprio.
 */

const DESDE = '2020-01-01T00:00:00.000Z';
const PAGO = 'teste_lp_pago';
const GRATIS_LOCAL = 'teste_lp_gratis';

const DIA = 86_400_000;

function semearPlanos() {
  const agora = new Date().toISOString();
  const inserir = db.prepare(
    `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
       parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
     VALUES (@id, @id, @preco, 30, 1, 1, 0, @direitos, 1, @agora, @agora)
     ON CONFLICT (id) DO UPDATE SET direitos_json = excluded.direitos_json`
  );
  const direitos = JSON.stringify({ leiturasPorMes: 2, perguntasOraculo: 10, perguntasOraculoPorDia: 2 });
  inserir.run({ id: PAGO, preco: 2990, direitos, agora });
  inserir.run({ id: GRATIS_LOCAL, preco: 0, direitos, agora });
}

/** Cria conta com `criado_em` no passado e assinatura do plano dado. */
function pessoa(opcoes: { diasAtras: number; plano?: string }): { id: string; email: string } {
  const id = randomUUID();
  const email = `${id}@bruxario.local`;
  const criadoEm = new Date(Date.now() - opcoes.diasAtras * DIA).toISOString();

  db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(id, email, criadoEm);

  if (opcoes.plano) {
    db.prepare(
      `INSERT INTO assinaturas (id, conta_id, plano_id, status, inicio, fim,
         renovacao_automatica, criado_em, atualizado_em)
       VALUES (?, ?, ?, 'ativa', ?, ?, 0, ?, ?)`
    ).run(
      randomUUID(), id, opcoes.plano, criadoEm,
      new Date(Date.now() + 20 * DIA).toISOString(), criadoEm, criadoEm
    );
  }
  return { id, email };
}

function fezLeitura(contaId: string) {
  db.prepare(
    `INSERT INTO leituras (id, conta_id, tipo, pergunta, semente, espetaculos_json,
       resposta_json, dia_de_ouro, criado_em)
     VALUES (?, ?, 'leitura', 'oi', 'x', '[]', '{}', 0, ?)`
  ).run(randomUUID(), contaId, new Date().toISOString());
}

function gastouLeituras(contaId: string, quantas: number) {
  const agora = new Date();
  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const dia = `${mes}-${String(agora.getDate()).padStart(2, '0')}`;
  const gravar = db.prepare(
    `INSERT INTO consumo (conta_id, recurso, janela, chave, usado, atualizado_em)
     VALUES (?, 'leitura', ?, ?, ?, ?)
     ON CONFLICT (conta_id, recurso, janela, chave) DO UPDATE SET usado = excluded.usado`
  );
  gravar.run(contaId, 'mes', mes, quantas, agora.toISOString());
  gravar.run(contaId, 'dia', dia, quantas, agora.toISOString());
}

beforeEach(() => {
  db.exec('DELETE FROM leituras');
  db.exec('DELETE FROM consumo');
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
  semearPlanos();
});

after(() => {
  db.exec('DELETE FROM leituras');
  db.exec('DELETE FROM consumo');
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
  db.prepare("DELETE FROM planos WHERE id LIKE 'teste_lp_%'").run();
});

describe('quem entra na lista', () => {
  test('quem entrou há dias, no gratuito, sem leitura nenhuma', () => {
    const p = pessoa({ diasAtras: DIAS_DE_ESPERA + 1, plano: GRATIS_LOCAL });
    const lista = leiturasParadas({ desde: DESDE });
    assert.equal(lista.length, 1);
    assert.equal(lista[0].email, p.email);
    assert.equal(lista[0].quantas, 2, 'diz quantas leituras estão paradas');
  });
});

describe('quem fica de fora', () => {
  /** Ainda no calor da revelação — e-mail aí é atropelo. */
  test('quem entrou ontem', () => {
    pessoa({ diasAtras: 1, plano: GRATIS_LOCAL });
    assert.equal(leiturasParadas({ desde: DESDE }).length, 0);
  });

  test('quem já fez uma leitura — já conhece o produto', () => {
    const p = pessoa({ diasAtras: 10, plano: GRATIS_LOCAL });
    fezLeitura(p.id);
    assert.equal(leiturasParadas({ desde: DESDE }).length, 0);
  });

  /**
   * O filtro que mais importa: "resgate sua leitura gratuita" para quem
   * acabou de pagar 29,90 é a mensagem errada para a pessoa errada.
   */
  test('quem assina plano pago', () => {
    pessoa({ diasAtras: 10, plano: PAGO });
    assert.equal(leiturasParadas({ desde: DESDE }).length, 0);
  });

  test('quem já gastou a cota do mês — não há o que resgatar', () => {
    const p = pessoa({ diasAtras: 10, plano: GRATIS_LOCAL });
    gastouLeituras(p.id, 2);
    assert.equal(leiturasParadas({ desde: DESDE }).length, 0);
  });

  test('quem não tem plano nenhum — sem direito, sem cota', () => {
    pessoa({ diasAtras: 10 });
    assert.equal(leiturasParadas({ desde: DESDE }).length, 0);
  });

  /**
   * Sem o corte, a primeira execução em produção varre a base histórica
   * inteira de uma vez — uma onda de e-mail para gente de meses atrás.
   */
  test('quem entrou antes do corte', () => {
    pessoa({ diasAtras: 400, plano: GRATIS_LOCAL });
    const corte = new Date(Date.now() - 30 * DIA).toISOString();
    assert.equal(leiturasParadas({ desde: corte }).length, 0);
    assert.equal(leiturasParadas({ desde: DESDE }).length, 1, 'e entra sem o corte');
  });
});

describe('cota parcial', () => {
  /**
   * O e-mail fala do que se perde na virada do mês, então quem conta é o
   * restante MENSAL. Filtrar pelo teto diário deixava de fora quem tivesse
   * usado a leitura de hoje — e como o teto do dia é 1, isso era quase todo
   * mundo com cota mensal maior que um.
   */
  test('quem gastou a leitura de hoje mas tem mês sobrando ainda entra', () => {
    const p = pessoa({ diasAtras: 10, plano: GRATIS_LOCAL });
    gastouLeituras(p.id, 1);
    const lista = leiturasParadas({ desde: DESDE });
    assert.equal(lista.length, 1, 'o teto do dia não esconde o que sobra no mês');
    assert.equal(lista[0].quantas, 1);
  });

  test('gasto só no mês (dia limpo) deixa a leitura disponível', () => {
    const p = pessoa({ diasAtras: 10, plano: GRATIS_LOCAL });
    const agora = new Date();
    const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    db.prepare(
      `INSERT INTO consumo (conta_id, recurso, janela, chave, usado, atualizado_em)
       VALUES (?, 'leitura', 'mes', ?, 1, ?)`
    ).run(p.id, mes, agora.toISOString());

    const lista = leiturasParadas({ desde: DESDE });
    assert.equal(lista.length, 1);
    assert.equal(lista[0].quantas, 1, 'sobra uma do mês');
  });
});
