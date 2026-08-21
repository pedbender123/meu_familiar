import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  criarTokenMagico,
  consumirTokenMagico,
  abrirSessao,
  lerSessao,
  fecharSessao,
  garantirConta,
  buscarConta,
  ehAdmin,
  emailDoAdmin,
} from './autenticacao';
import db from './db';

/**
 * Autenticação é onde um erro deixa de ser bug e vira invasão. Cada teste
 * aqui corresponde a uma forma conhecida de entrar sem permissão.
 */
const EMAIL = 'pessoa@exemplo.com';

beforeEach(() => {
  db.exec("DELETE FROM tokens_magicos; DELETE FROM sessoes; DELETE FROM contas");
  delete process.env.ADMIN_EMAIL;
});

describe('link mágico', () => {
  test('o token em claro NUNCA é gravado — só o hash', () => {
    const token = criarTokenMagico(EMAIL, 'conta');
    const linhas = db.prepare('SELECT hash FROM tokens_magicos').all() as {
      hash: string;
    }[];
    assert.equal(linhas.length, 1);
    assert.notEqual(linhas[0].hash, token, 'o token foi gravado em claro!');
    // e o hash não contém o token
    assert.ok(!linhas[0].hash.includes(token.slice(0, 12)));
  });

  test('um token válido abre uma vez', () => {
    const token = criarTokenMagico(EMAIL, 'conta');
    const v = consumirTokenMagico(token);
    assert.equal(v?.email, EMAIL);
    assert.equal(v?.tipo, 'conta');
  });

  test('o MESMO token não abre duas vezes', () => {
    const token = criarTokenMagico(EMAIL, 'conta');
    assert.ok(consumirTokenMagico(token));
    assert.equal(
      consumirTokenMagico(token),
      null,
      'link reutilizável: e-mail encaminhado viraria acesso permanente'
    );
  });

  test('token inventado não abre', () => {
    criarTokenMagico(EMAIL, 'conta');
    assert.equal(consumirTokenMagico('token-que-eu-inventei'), null);
    assert.equal(consumirTokenMagico(''), null);
  });

  test('token expirado não abre', () => {
    const token = criarTokenMagico(EMAIL, 'conta');
    db.prepare('UPDATE tokens_magicos SET expira_em = ?').run(
      new Date(Date.now() - 1000).toISOString()
    );
    assert.equal(consumirTokenMagico(token), null);
  });

  test('o e-mail volta normalizado, para não criar duas contas da mesma pessoa', () => {
    const token = criarTokenMagico('  PESSOA@Exemplo.COM ', 'conta');
    assert.equal(consumirTokenMagico(token)?.email, EMAIL);
  });
});

describe('sessão', () => {
  test('o token de sessão também só existe hasheado no banco', () => {
    const { token } = abrirSessao(EMAIL, 'conta');
    const linhas = db.prepare('SELECT hash FROM sessoes').all() as { hash: string }[];
    assert.notEqual(linhas[0].hash, token);
  });

  test('sessão válida é lida; inventada não', () => {
    const { token } = abrirSessao(EMAIL, 'conta');
    assert.equal(lerSessao(token)?.email, EMAIL);
    assert.equal(lerSessao('inventado'), null);
    assert.equal(lerSessao(undefined), null);
  });

  test('sair invalida no BANCO, não só no cookie', () => {
    const { token } = abrirSessao(EMAIL, 'conta');
    fecharSessao(token);
    assert.equal(
      lerSessao(token),
      null,
      'sessão sobreviveu ao logout: cópia do cookie continuaria entrando'
    );
  });

  test('sessão expirada não vale', () => {
    const { token } = abrirSessao(EMAIL, 'conta');
    db.prepare('UPDATE sessoes SET expira_em = ?').run(
      new Date(Date.now() - 1000).toISOString()
    );
    assert.equal(lerSessao(token), null);
  });
});

describe('painel', () => {
  test('sem ADMIN_EMAIL configurado, ninguém é admin', () => {
    assert.equal(emailDoAdmin(), null);
    assert.equal(ehAdmin('qualquer@um.com'), false);
  });

  test('só o endereço configurado é admin, ignorando caixa e espaços', () => {
    process.env.ADMIN_EMAIL = 'dono@bruxario.com.br';
    assert.equal(ehAdmin('dono@bruxario.com.br'), true);
    assert.equal(ehAdmin('  DONO@Bruxario.com.BR '), true);
    assert.equal(ehAdmin('outro@bruxario.com.br'), false);
    assert.equal(ehAdmin('dono@bruxario.com.br.atacante.com'), false);
  });

  test('sessão de admin morre se o ADMIN_EMAIL mudar', () => {
    process.env.ADMIN_EMAIL = 'dono@bruxario.com.br';
    const { token } = abrirSessao('dono@bruxario.com.br', 'admin');
    assert.equal(lerSessao(token)?.tipo, 'admin');

    process.env.ADMIN_EMAIL = 'outro-dono@bruxario.com.br';
    assert.equal(
      lerSessao(token),
      null,
      'trocar o dono precisa expulsar quem entrou com o endereço antigo'
    );
  });

  test('token de conta não vira sessão de admin', () => {
    process.env.ADMIN_EMAIL = 'dono@bruxario.com.br';
    const token = criarTokenMagico('dono@bruxario.com.br', 'conta');
    assert.equal(consumirTokenMagico(token)?.tipo, 'conta');
  });

  test('o dono do painel também tem conta pessoal, separada', () => {
    // Regressão real: `ehAdmin(email)` no caminho da conta sequestrava o login
    // normal do dono e o jogava no painel. Ser o endereço do painel é a chave
    // de UMA porta, não um carimbo na pessoa.
    process.env.ADMIN_EMAIL = 'dono@bruxario.com.br';

    const daConta = criarTokenMagico('dono@bruxario.com.br', 'conta');
    assert.equal(consumirTokenMagico(daConta)?.tipo, 'conta');

    const doPainel = criarTokenMagico('dono@bruxario.com.br', 'admin');
    assert.equal(consumirTokenMagico(doPainel)?.tipo, 'admin');

    // e as duas sessões coexistem sem uma virar a outra
    const s1 = abrirSessao('dono@bruxario.com.br', 'conta');
    const s2 = abrirSessao('dono@bruxario.com.br', 'admin');
    assert.equal(lerSessao(s1.token)?.tipo, 'conta');
    assert.equal(lerSessao(s2.token)?.tipo, 'admin');
  });
});

describe('contas', () => {
  test('garantirConta é idempotente — o webhook repete', () => {
    const a = garantirConta(EMAIL);
    const b = garantirConta(EMAIL);
    assert.equal(a.id, b.id);
    const n = db.prepare('SELECT count(*) n FROM contas').get() as { n: number };
    assert.equal(n.n, 1);
  });

  test('caixa alta e espaços não criam conta duplicada', () => {
    garantirConta(EMAIL);
    garantirConta('  PESSOA@EXEMPLO.COM  ');
    const n = db.prepare('SELECT count(*) n FROM contas').get() as { n: number };
    assert.equal(n.n, 1);
    assert.ok(buscarConta('Pessoa@Exemplo.com'));
  });
});
