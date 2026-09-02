import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import { criarCampanha, criarPeca, apagarCampanha, listarPecas } from './campanhas';

/**
 * Apagar uma campanha precisa apagar o que apontava para ela.
 *
 * ── O estado que a versão anterior deixava ────────────────────────────────
 *
 * Era um `DELETE` na linha da campanha, e só. Os pedidos ficavam com um
 * `campanha_id` que não existe mais — e aí eles somem de todo relatório de
 * campanha (não há campanha para filtrar) e também não contam como tráfego
 * direto (o campo não é nulo). Um terceiro estado que nenhuma tela mostra.
 *
 * É por isso que o painel nunca ficava limpo: apagar tirava a linha da lista
 * e deixava o rastro no banco.
 */

beforeEach(() => {
  db.exec('DELETE FROM campanhas');
  db.exec('DELETE FROM pecas');
  db.exec('DELETE FROM pedidos');
});

function comCampanha() {
  // `criarCampanha` devolve o id, não a campanha.
  const campanhaId = criarCampanha({ nome: 'para apagar', inicio: new Date().toISOString() });
  const peca = criarPeca({ campanha_id: campanhaId, nome: 'video 1' });
  assert.ok(peca.ok);
  db.prepare(
    `INSERT INTO pedidos (id, nome, email, respostas_json, familiar, lua, produto,
       campanha_id, peca_id, status, criado_em, atualizado_em)
     VALUES ('ped1','Ana','a@b.c','{}','coruja','cheia','completa', ?, ?, 'entregue',
       '2026-09-01T00:00:00.000Z','2026-09-01T00:00:00.000Z')`
  ).run(campanhaId, peca.id);
  return { campanhaId, pecaId: peca.id };
}

describe('apagar uma campanha', () => {
  test('leva as peças junto', () => {
    const { campanhaId } = comCampanha();
    apagarCampanha(campanhaId);
    assert.equal(listarPecas(campanhaId).length, 0);
  });

  /**
   * O pedido continua existindo — a venda aconteceu. Ele só perde a
   * atribuição, que é a verdade depois de a campanha deixar de existir.
   */
  test('o pedido sobrevive, sem campanha', () => {
    const { campanhaId } = comCampanha();
    apagarCampanha(campanhaId);

    const p = db.prepare('SELECT campanha_id, peca_id FROM pedidos WHERE id = ?').get('ped1') as
      | { campanha_id: string | null; peca_id: string | null }
      | undefined;

    assert.ok(p, 'a venda não pode ser apagada junto');
    assert.equal(p.campanha_id, null, 'sem referência pendurada');
    assert.equal(p.peca_id, null);
  });

  /** O estado exato que fazia o pedido sumir das duas telas ao mesmo tempo. */
  test('não sobra pedido apontando para campanha inexistente', () => {
    const { campanhaId } = comCampanha();
    apagarCampanha(campanhaId);

    const orfaos = db
      .prepare(
        `SELECT COUNT(*) c FROM pedidos
          WHERE campanha_id IS NOT NULL
            AND campanha_id NOT IN (SELECT id FROM campanhas)`
      )
      .get() as { c: number };
    assert.equal(orfaos.c, 0);
  });
});
