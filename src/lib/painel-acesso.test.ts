import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import {
  podeVerPainel,
  podeEditarPainel,
  ehAdmin,
  adicionarAcessoAoPainel,
  removerAcessoAoPainel,
  listarAcessosDoPainel,
  abrirSessao,
  lerSessao,
} from './autenticacao';

const DONO = 'dono@bruxario.local';
const LEITOR = 'leitor@bruxario.local';

let antes: string | undefined;

beforeEach(() => {
  antes = process.env.ADMIN_EMAIL;
  process.env.ADMIN_EMAIL = DONO;
  db.exec('DELETE FROM painel_acessos');
  db.exec("DELETE FROM sessoes WHERE tipo = 'admin'");
});

afterEach(() => {
  if (antes === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = antes;
});

describe('quem vê o painel', () => {
  test('o dono vê, mesmo sem linha nenhuma na tabela', () => {
    assert.equal(listarAcessosDoPainel().length, 0);
    assert.ok(podeVerPainel(DONO));
  });

  test('quem não está em lugar nenhum não vê', () => {
    assert.equal(podeVerPainel('estranho@exemplo.com'), false);
  });

  test('quem entra na lista passa a ver', () => {
    assert.equal(podeVerPainel(LEITOR), false);
    adicionarAcessoAoPainel(LEITOR, DONO);
    assert.ok(podeVerPainel(LEITOR));
  });

  test('e-mail é comparado sem caixa nem espaço', () => {
    adicionarAcessoAoPainel('  MAIUSCULA@Exemplo.COM ', DONO);
    assert.ok(podeVerPainel('maiuscula@exemplo.com'));
  });
});

describe('quem altera', () => {
  /** A regra central: leitor não vira editor por nenhum caminho. */
  test('só o dono altera — quem está na lista, nunca', () => {
    adicionarAcessoAoPainel(LEITOR, DONO);
    assert.ok(podeEditarPainel(DONO));
    assert.equal(podeEditarPainel(LEITOR), false);
  });

  /**
   * `painel_acessos.papel` tem CHECK que só admite 'leitor'. Mesmo com acesso
   * de escrita ao banco, ninguém se promove editando a própria linha.
   */
  test('não dá para se promover mexendo na tabela', () => {
    adicionarAcessoAoPainel(LEITOR, DONO);
    assert.throws(
      () => db.prepare("UPDATE painel_acessos SET papel = 'dono' WHERE email = ?").run(LEITOR),
      /CHECK/i
    );
    assert.equal(podeEditarPainel(LEITOR), false);
  });
});

describe('o dono não sai da lista', () => {
  test('adicionar o dono não cria linha — ele não vem da tabela', () => {
    assert.equal(adicionarAcessoAoPainel(DONO, DONO), false);
    assert.equal(listarAcessosDoPainel().length, 0);
    assert.ok(podeVerPainel(DONO), 'e ele continua vendo');
  });

  test('remover o dono não faz nada, e ele segue entrando', () => {
    removerAcessoAoPainel(DONO);
    assert.ok(podeVerPainel(DONO));
    assert.ok(podeEditarPainel(DONO));
  });

  test('apagar a tabela inteira não tira o acesso do dono', () => {
    adicionarAcessoAoPainel(LEITOR, DONO);
    db.exec('DELETE FROM painel_acessos');
    assert.ok(podeVerPainel(DONO));
    assert.equal(podeVerPainel(LEITOR), false);
  });
});

describe('tirar da equipe vale na hora', () => {
  test('a sessão aberta do removido para de valer', () => {
    adicionarAcessoAoPainel(LEITOR, DONO);
    const { token } = abrirSessao(LEITOR, 'admin');
    assert.ok(lerSessao(token), 'entrou');

    removerAcessoAoPainel(LEITOR);
    assert.equal(lerSessao(token), null, 'e saiu no mesmo instante');
  });

  test('a sessão do dono não é afetada por mexidas na tabela', () => {
    const { token } = abrirSessao(DONO, 'admin');
    adicionarAcessoAoPainel(LEITOR, DONO);
    removerAcessoAoPainel(LEITOR);
    db.exec('DELETE FROM painel_acessos');
    assert.ok(lerSessao(token));
  });

  /** Trocar ADMIN_EMAIL no ambiente derruba a sessão do endereço antigo. */
  test('trocar o dono no ambiente invalida a sessão antiga', () => {
    const { token } = abrirSessao(DONO, 'admin');
    assert.ok(lerSessao(token));
    process.env.ADMIN_EMAIL = 'outro@bruxario.local';
    assert.equal(lerSessao(token), null);
  });
});

describe('ehAdmin continua sendo só o dono', () => {
  test('não confunde equipe com dono', () => {
    adicionarAcessoAoPainel(LEITOR, DONO);
    assert.ok(ehAdmin(DONO));
    assert.equal(ehAdmin(LEITOR), false);
  });
});
