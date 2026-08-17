import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
// Importado pelo efeito colateral: é `autenticacao.ts` que cria a tabela
// `contas`, e sem ele o `DELETE FROM contas` do beforeEach não tem o que
// apagar. Nenhum outro módulo deste teste a puxa.
import '../lib/autenticacao';
import { criarAssinatura, assinaturasAtivasDaConta, buscarAssinatura } from './assinaturas';
import { expirarVencidas, vencendoEm } from './ciclo-de-assinatura';
import { direitosEfetivos } from './acesso';

const UM_DIA = 86_400_000;

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
  db.exec('DELETE FROM pedidos');
});

function conta(email = `${randomUUID()}@teste.com`): { id: string; email: string } {
  const id = randomUUID();
  db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(
    id,
    email,
    new Date().toISOString()
  );
  return { id, email };
}

describe('fim calculado a partir do plano', () => {
  test('plano com duracao_dias ganha fim automaticamente', () => {
    const c = conta();
    const a = criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal' })!;
    assert.ok(a.fim, 'assinatura de plano com prazo não pode nascer sem fim');

    const dias = Math.round((new Date(a.fim!).getTime() - new Date(a.inicio).getTime()) / UM_DIA);
    assert.equal(dias, 30);
  });

  test('plano anual dá 365 dias', () => {
    const c = conta();
    const a = criarAssinatura({ contaId: c.id, planoId: 'revelacao_anual' })!;
    const dias = Math.round((new Date(a.fim!).getTime() - new Date(a.inicio).getTime()) / UM_DIA);
    assert.equal(dias, 365);
  });

  test('plano sem prazo (avulso antigo) continua pra sempre', () => {
    const c = conta();
    const a = criarAssinatura({ contaId: c.id, planoId: 'completa' })!;
    assert.equal(a.fim, null);
  });

  test('fim explícito vence o do plano — é como a cortesia dá 30 dias de um anual', () => {
    const c = conta();
    const trintaDias = new Date(Date.now() + 30 * UM_DIA).toISOString();
    const a = criarAssinatura({ contaId: c.id, planoId: 'revelacao_anual', fim: trintaDias })!;
    assert.equal(a.fim, trintaDias);
  });

  test('fim: null explícito força pra sempre mesmo em plano com prazo', () => {
    const c = conta();
    const a = criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal', fim: null })!;
    assert.equal(a.fim, null);
  });

  test('plano inexistente não trava ninguém: vira pra sempre em vez de lançar', () => {
    const c = conta();
    const a = criarAssinatura({ contaId: c.id, planoId: 'plano-que-nao-existe' });
    assert.ok(a);
    assert.equal(a!.fim, null);
  });
});

describe('expirarVencidas', () => {
  test('marca como expirada quem passou do fim', () => {
    const c = conta();
    const ontem = new Date(Date.now() - UM_DIA).toISOString();
    const a = criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal', fim: ontem })!;

    assert.equal(expirarVencidas(), 1);
    assert.equal(buscarAssinatura(a.id)!.status, 'expirada');
  });

  test('não toca em quem ainda vale', () => {
    const c = conta();
    criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal' });
    assert.equal(expirarVencidas(), 0);
  });

  test('o acesso já fecha sozinho ANTES do job rodar — job parado nunca libera acesso indevido', () => {
    const c = conta();
    const ontem = new Date(Date.now() - UM_DIA).toISOString();
    criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal', fim: ontem });

    // Sem chamar expirarVencidas():
    assert.equal(assinaturasAtivasDaConta(c.id).length, 0);
  });

  test('rodar duas vezes não conta a mesma assinatura de novo', () => {
    const c = conta();
    const ontem = new Date(Date.now() - UM_DIA).toISOString();
    criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal', fim: ontem });

    assert.equal(expirarVencidas(), 1);
    assert.equal(expirarVencidas(), 0);
  });
});

describe('vencendoEm', () => {
  test('acha quem vence dentro da janela', () => {
    const c = conta();
    criarAssinatura({
      contaId: c.id,
      planoId: 'revelacao_mensal',
      fim: new Date(Date.now() + 3 * UM_DIA).toISOString(),
    });

    const lista = vencendoEm(7);
    assert.equal(lista.length, 1);
    assert.equal(lista[0].email, c.email);
    assert.equal(lista[0].dias_restantes, 3);
  });

  test('ignora quem vence depois da janela', () => {
    const c = conta();
    criarAssinatura({
      contaId: c.id,
      planoId: 'revelacao_mensal',
      fim: new Date(Date.now() + 20 * UM_DIA).toISOString(),
    });
    assert.equal(vencendoEm(7).length, 0);
  });

  test('ignora quem JÁ venceu — esse caso é do expirarVencidas, não do aviso', () => {
    const c = conta();
    criarAssinatura({
      contaId: c.id,
      planoId: 'revelacao_mensal',
      fim: new Date(Date.now() - UM_DIA).toISOString(),
    });
    assert.equal(vencendoEm(7).length, 0);
  });

  test('ignora quem tem renovação automática — vai ser cobrado, não precisa ser lembrado', () => {
    const c = conta();
    const a = criarAssinatura({
      contaId: c.id,
      planoId: 'revelacao_mensal',
      fim: new Date(Date.now() + 3 * UM_DIA).toISOString(),
    })!;
    db.prepare('UPDATE assinaturas SET renovacao_automatica = 1 WHERE id = ?').run(a.id);
    assert.equal(vencendoEm(7).length, 0);
  });

  test('assinatura sem fim nunca aparece no aviso', () => {
    const c = conta();
    criarAssinatura({ contaId: c.id, planoId: 'completa' });
    assert.equal(vencendoEm(7).length, 0);
  });
});

/**
 * A garantia que a migração de cortesia depende: dar 30 dias de assinatura a
 * quem comprou avulso não pode virar uma degradação no dia 31.
 */
describe('cortesia não rebaixa quem já tinha comprado', () => {
  test('quando a cortesia expira, a pessoa volta ao que comprou — não fica sem nada', () => {
    const c = conta();
    // Compra antiga, paga, que dá acesso pra sempre:
    db.prepare(
      `INSERT INTO pedidos (id, nome, email, produto, status, respostas_json, familiar, lua, criado_em, atualizado_em)
       VALUES (?, 'Teste', ?, 'completa', 'entregue', '{}', 'gato', 'cheia', ?, ?)`
    ).run(randomUUID(), c.email, new Date().toISOString(), new Date().toISOString());

    // Cortesia JÁ vencida:
    criarAssinatura({
      contaId: c.id,
      planoId: 'revelacao_mensal',
      fim: new Date(Date.now() - UM_DIA).toISOString(),
    });

    const direitos = direitosEfetivos(c.id, c.email);
    assert.equal(direitos.relatorioCompleto, true, 'perdeu o relatório que comprou pra sempre');
    assert.equal(direitos.graficos, true, 'perdeu os gráficos que comprou pra sempre');
    assert.equal(direitos.perfilCompleto, true, 'perdeu o perfil que comprou');
  });

  test('enquanto a cortesia vale, a pessoa tem o dela MAIS o que a assinatura abre', () => {
    const c = conta();
    db.prepare(
      `INSERT INTO pedidos (id, nome, email, produto, status, respostas_json, familiar, lua, criado_em, atualizado_em)
       VALUES (?, 'Teste', ?, 'revelacao', 'entregue', '{}', 'gato', 'cheia', ?, ?)`
    ).run(randomUUID(), c.email, new Date().toISOString(), new Date().toISOString());

    criarAssinatura({ contaId: c.id, planoId: 'revelacao_mensal' });

    const direitos = direitosEfetivos(c.id, c.email);
    assert.equal(direitos.pdf, true, 'o que ela comprou');
    assert.equal(direitos.perguntasOraculo, 10, 'o que a cortesia abriu');
    assert.equal(direitos.oraculoNaHora, true);
  });
});
