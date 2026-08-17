import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
import '../lib/autenticacao';
import { criarAssinatura } from './assinaturas';
import { consumir, devolver, estadoDaCota, chaveDoDia, chaveDoMes } from './consumo';

/**
 * Planos PRÓPRIOS deste teste.
 *
 * Os testes de cota não podem depender dos números comerciais dos planos
 * reais: eles mudam quando o produto muda de preço, e aí o mecanismo (que
 * não mudou) aparece como quebrado. Aqui os tetos são fixos e conhecidos —
 * 10 no mês, 5 no dia — e o que se testa é a mecânica das duas travas.
 */
const TESTE_10_5 = 'teste_cota_10_5';
const TESTE_SEM_ORACULO = 'teste_cota_zero';

function semearPlanosDeTeste() {
  const agora = new Date().toISOString();
  const inserir = db.prepare(
    `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
       parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
     VALUES (@id, @id, 0, NULL, 0, 1, 0, @direitos, 1, @agora, @agora)
     ON CONFLICT (id) DO UPDATE SET direitos_json = excluded.direitos_json`
  );

  inserir.run({
    id: TESTE_10_5,
    direitos: JSON.stringify({
      perguntasOraculo: 10,
      perguntasOraculoPorDia: 5,
      leiturasPorMes: 3,
    }),
    agora,
  });
  inserir.run({
    id: TESTE_SEM_ORACULO,
    direitos: JSON.stringify({
      perguntasOraculo: 0,
      perguntasOraculoPorDia: 0,
      leiturasPorMes: 0,
    }),
    agora,
  });
}

beforeEach(() => {
  db.exec('DELETE FROM consumo');
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
  semearPlanosDeTeste();
});

/** Conta com o plano pedido. O padrão dá 10/mês e 5/dia. */
function conta(planoId = TESTE_10_5): { id: string; email: string } {
  const id = randomUUID();
  const email = `${id}@teste.com`;
  db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(
    id,
    email,
    new Date().toISOString()
  );
  criarAssinatura({ contaId: id, planoId });
  return { id, email };
}

describe('chaves de janela', () => {
  test('o dia inclui o dia; o mês, não', () => {
    const q = new Date(2026, 7, 17, 23, 59);
    assert.equal(chaveDoDia(q), '2026-08-17');
    assert.equal(chaveDoMes(q), '2026-08');
  });

  test('meses de um dígito vêm com zero à esquerda (senão "2026-9" ordena errado)', () => {
    assert.equal(chaveDoMes(new Date(2026, 8, 5)), '2026-09');
    assert.equal(chaveDoDia(new Date(2026, 8, 5)), '2026-09-05');
  });
});

describe('consumir', () => {
  test('conta sem plano nenhum não consome', () => {
    const id = randomUUID();
    const email = `${id}@teste.com`;
    db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(
      id,
      email,
      new Date().toISOString()
    );

    const r = consumir(id, email, 'mensagem');
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.motivo, 'sem_plano');
  });

  test('primeiro uso passa e desconta dos dois tetos', () => {
    const c = conta();
    const r = consumir(c.id, c.email, 'mensagem');
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.restanteHoje, 4);
    assert.equal(r.ok && r.restanteNoMes, 9);
  });

  test('o teto do DIA barra antes do mensal acabar', () => {
    const c = conta(); // 10/mês, 5/dia
    for (let i = 0; i < 5; i++) {
      assert.equal(consumir(c.id, c.email, 'mensagem').ok, true, `uso ${i + 1}`);
    }

    const sexto = consumir(c.id, c.email, 'mensagem');
    assert.equal(sexto.ok, false);
    assert.equal(sexto.ok === false && sexto.motivo, 'sem_cota_no_dia');

    // ...e sobra cota no mês, que é o ponto da trava dupla.
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').restanteNoMes, 5);
  });

  test('virou o dia, a cota diária volta — sem ninguém zerar nada', () => {
    const c = conta();
    const hoje = new Date(2026, 7, 17, 10);
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', hoje);
    assert.equal(consumir(c.id, c.email, 'mensagem', hoje).ok, false);

    const amanha = new Date(2026, 7, 18, 10);
    assert.equal(consumir(c.id, c.email, 'mensagem', amanha).ok, true);
  });

  test('o teto do MÊS barra mesmo com o dia zerado', () => {
    const c = conta(); // 10 no mês
    // 5 num dia, 5 no outro = 10 no mês.
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 1, 10));
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 2, 10));

    const terceiroDia = consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 3, 10));
    assert.equal(terceiroDia.ok, false);
    assert.equal(terceiroDia.ok === false && terceiroDia.motivo, 'sem_cota_no_mes');
  });

  test('virou o mês, tudo volta', () => {
    const c = conta();
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 1, 10));
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 2, 10));
    assert.equal(consumir(c.id, c.email, 'mensagem', new Date(2026, 7, 3, 10)).ok, false);

    assert.equal(consumir(c.id, c.email, 'mensagem', new Date(2026, 8, 1, 10)).ok, true);
  });

  test('a virada do ano não confunde as chaves', () => {
    const c = conta();
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem', new Date(2026, 11, 31, 10));
    assert.equal(consumir(c.id, c.email, 'mensagem', new Date(2026, 11, 31, 23)).ok, false);
    assert.equal(consumir(c.id, c.email, 'mensagem', new Date(2027, 0, 1, 0)).ok, true);
  });

  test('cotas de recursos diferentes não se misturam', () => {
    const c = conta();
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem');
    assert.equal(consumir(c.id, c.email, 'mensagem').ok, false);

    // Leitura tem cota própria — mensagem esgotada não bloqueia leitura.
    assert.equal(consumir(c.id, c.email, 'leitura').ok, true);
  });

  test('uma conta não gasta a cota da outra', () => {
    const a = conta();
    const b = conta();
    for (let i = 0; i < 5; i++) consumir(a.id, a.email, 'mensagem');

    assert.equal(consumir(a.id, a.email, 'mensagem').ok, false);
    assert.equal(consumir(b.id, b.email, 'mensagem').ok, true);
  });

  /**
   * O bug clássico deste tipo de contador: duas abas leem "usado: 4", as duas
   * concluem que cabe, as duas gravam 5 — a pessoa gastou uma e levou duas.
   * Aqui as chamadas são síncronas (better-sqlite3), então o que se prova é
   * que o total gasto nunca passa do teto por mais que se martele.
   */
  test('marteladas seguidas nunca ultrapassam o teto', () => {
    const c = conta();
    let aprovados = 0;
    for (let i = 0; i < 50; i++) {
      if (consumir(c.id, c.email, 'mensagem').ok) aprovados++;
    }
    assert.equal(aprovados, 5, 'só o teto diário podia passar');

    const uso = db
      .prepare(
        `SELECT usado FROM consumo WHERE conta_id = ? AND recurso = 'mensagem' AND janela = 'dia'`
      )
      .get(c.id) as { usado: number };
    assert.equal(uso.usado, 5, 'o contador não pode passar do teto');
  });
});

describe('estadoDaCota', () => {
  test('conta nova mostra os tetos cheios', () => {
    const c = conta();
    const e = estadoDaCota(c.id, c.email, 'mensagem');
    assert.equal(e.usadoHoje, 0);
    assert.equal(e.tetoDiario, 5);
    assert.equal(e.tetoMensal, 10);
    assert.equal(e.disponivel, 5, 'o menor dos dois restantes');
  });

  test('disponivel é o MENOR dos restantes — não promete o que o dia não deixa', () => {
    const c = conta();
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem');

    const e = estadoDaCota(c.id, c.email, 'mensagem');
    assert.equal(e.restanteNoMes, 5, 'ainda sobra no mês');
    assert.equal(e.restanteHoje, 0);
    assert.equal(e.disponivel, 0, 'mas hoje não dá — é isso que a tela mostra');
  });

  test('não consome nada ao consultar', () => {
    const c = conta();
    estadoDaCota(c.id, c.email, 'mensagem');
    estadoDaCota(c.id, c.email, 'mensagem');
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').usadoHoje, 0);
  });

  test('plano sem Oráculo mostra zero, e não número negativo', () => {
    const c = conta(TESTE_SEM_ORACULO);
    const e = estadoDaCota(c.id, c.email, 'mensagem');
    assert.equal(e.disponivel, 0);
    assert.ok(e.restanteHoje >= 0 && e.restanteNoMes >= 0);
  });
});

describe('devolver', () => {
  test('devolve a unidade quando a geração falha', () => {
    const c = conta();
    consumir(c.id, c.email, 'mensagem');
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').usadoHoje, 1);

    devolver(c.id, 'mensagem');
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').usadoHoje, 0);
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').usadoNoMes, 0);
  });

  test('nunca desce abaixo de zero — devolver duas vezes não dá cota de graça', () => {
    const c = conta();
    consumir(c.id, c.email, 'mensagem');
    devolver(c.id, 'mensagem');
    devolver(c.id, 'mensagem');
    devolver(c.id, 'mensagem');

    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').usadoHoje, 0);
    assert.equal(estadoDaCota(c.id, c.email, 'mensagem').disponivel, 5, 'e não 8');
  });

  test('depois de devolver, dá pra consumir de novo', () => {
    const c = conta();
    for (let i = 0; i < 5; i++) consumir(c.id, c.email, 'mensagem');
    assert.equal(consumir(c.id, c.email, 'mensagem').ok, false);

    devolver(c.id, 'mensagem');
    assert.equal(consumir(c.id, c.email, 'mensagem').ok, true);
  });
});
