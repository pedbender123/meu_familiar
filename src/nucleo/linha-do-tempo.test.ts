import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db, { criarPedido, registrarEvento } from '../lib/db';
import { linhaDoTempoDoPedido } from './linha-do-tempo';
import { registrarAnomalia } from './sentinela/registrar';
import { enfileirarEventoCapi } from '../lib/fila-capi';

function novoPedido(visitante: string): string {
  const id = randomUUID();
  criarPedido({
    id,
    nome: 'Helena',
    email: 'helena@exemplo.com',
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: 'Touro',
    signo_lua: 'Touro',
    produto: 'revelacao',
    visitante,
  });
  return id;
}

beforeEach(() => {
  db.exec('DELETE FROM pedidos');
  db.exec('DELETE FROM eventos');
  db.exec('DELETE FROM anomalias');
  db.exec('DELETE FROM fila_capi');
  db.exec('DELETE FROM marcos');
  db.exec('DELETE FROM toques');
});

describe('linhaDoTempoDoPedido', () => {
  test('pedido inexistente: lista vazia, sem lançar', () => {
    assert.deepEqual(linhaDoTempoDoPedido('id-que-nao-existe'), []);
  });

  test('pedido sem rastro nenhum: lista vazia', () => {
    const id = novoPedido('visitante-1');
    assert.deepEqual(linhaDoTempoDoPedido(id), []);
  });

  test('junta eventos do sistema, com rótulo amigável quando existe', () => {
    const id = novoPedido('visitante-1');
    registrarEvento('pagamento_confirmado', id);
    registrarEvento('pedido_entregue', id);

    const passos = linhaDoTempoDoPedido(id);
    assert.equal(passos.length, 2);
    assert.ok(passos.every((p) => p.categoria === 'sistema'));
    assert.equal(passos[0].rotulo, 'Pagamento confirmado');
    assert.equal(passos[1].rotulo, 'Entregue');
  });

  test('evento sem tradução cadastrada usa o próprio nome técnico como rótulo', () => {
    const id = novoPedido('visitante-1');
    registrarEvento('um_evento_que_ainda_nao_foi_traduzido', id);
    const [passo] = linhaDoTempoDoPedido(id);
    assert.equal(passo.rotulo, 'um_evento_que_ainda_nao_foi_traduzido');
  });

  test('junta marcos do funil (ligados por visitante, não por pedido_id)', () => {
    const id = novoPedido('visitante-1');
    db.prepare(
      `INSERT INTO marcos (visitante, marco, valor, criado_em) VALUES (?, ?, ?, ?)`
    ).run('visitante-1', 'ritual_iniciado', 3, new Date().toISOString());

    const passos = linhaDoTempoDoPedido(id);
    assert.equal(passos.length, 1);
    assert.equal(passos[0].categoria, 'funil');
    assert.equal(passos[0].rotulo, 'ritual_iniciado');
    assert.equal(passos[0].detalhe, 'cena 3');
  });

  test('marco de OUTRO visitante não vaza pra esta linha do tempo', () => {
    const id = novoPedido('visitante-1');
    db.prepare(
      `INSERT INTO marcos (visitante, marco, criado_em) VALUES (?, ?, ?)`
    ).run('visitante-DE-OUTRA-PESSOA', 'ritual_iniciado', new Date().toISOString());

    assert.deepEqual(linhaDoTempoDoPedido(id), []);
  });

  test('junta o status da fila do CAPI, com detalhe do erro quando desistiu', () => {
    const id = novoPedido('visitante-1');
    enfileirarEventoCapi({ pedidoId: id, nome: 'Purchase', quando: new Date(), eventId: `${id}:purchase` });
    db.prepare(
      `UPDATE fila_capi SET status = 'falhou_definitivo', tentativas = 8, ultimo_erro = 'token inválido' WHERE pedido_id = ?`
    ).run(id);

    const [passo] = linhaDoTempoDoPedido(id);
    assert.equal(passo.categoria, 'pixel');
    assert.match(passo.rotulo, /DESISTIU/);
    assert.match(passo.detalhe ?? '', /token inválido/);
  });

  test('junta anomalias da Sentinela específicas deste pedido', () => {
    const id = novoPedido('visitante-1');
    registrarAnomalia({
      invariante: 'valor_cobrado_bate_com_produto_e_cupom',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: id,
      esperado: '980 centavos',
      encontrado: 'nada cobrado',
    });

    const [passo] = linhaDoTempoDoPedido(id);
    assert.equal(passo.categoria, 'anomalia');
    assert.match(passo.rotulo, /critico/);
    assert.match(passo.detalhe ?? '', /980 centavos/);
  });

  test('anomalia de OUTRO pedido não aparece aqui', () => {
    const id = novoPedido('visitante-1');
    registrarAnomalia({
      invariante: 'x',
      severidade: 'critico',
      entidadeTipo: 'pedido',
      entidadeId: 'outro-pedido-qualquer',
      esperado: 'a',
      encontrado: 'b',
    });
    assert.deepEqual(linhaDoTempoDoPedido(id), []);
  });

  test('tudo junto sai ORDENADO por data, não agrupado por fonte', () => {
    const id = novoPedido('visitante-1');
    const t0 = new Date('2026-01-01T10:00:00.000Z');
    const t1 = new Date('2026-01-01T10:05:00.000Z');
    const t2 = new Date('2026-01-01T10:10:00.000Z');

    // Registra fora de ordem de propósito: sistema primeiro, funil por
    // último — pra confirmar que a saída reordena pela DATA, não pela fonte.
    db.exec(`DELETE FROM eventos`);
    db.prepare(`INSERT INTO eventos (tipo, pedido_id, criado_em) VALUES (?, ?, ?)`).run(
      'pagamento_confirmado',
      id,
      t1.toISOString()
    );
    registrarAnomalia({
      invariante: 'x',
      severidade: 'baixo',
      entidadeTipo: 'pedido',
      entidadeId: id,
      esperado: 'a',
      encontrado: 'b',
    });
    db.prepare(`UPDATE anomalias SET ocorrido_em = ? WHERE entidade_id = ?`).run(t0.toISOString(), id);
    db.prepare(`INSERT INTO marcos (visitante, marco, criado_em) VALUES (?, ?, ?)`).run(
      'visitante-1',
      'ritual_iniciado',
      t2.toISOString()
    );

    const passos = linhaDoTempoDoPedido(id);
    assert.deepEqual(
      passos.map((p) => p.categoria),
      ['anomalia', 'sistema', 'funil']
    );
  });
});
