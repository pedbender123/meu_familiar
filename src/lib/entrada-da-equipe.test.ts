import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import db from './db';
import { podeVerPainel, podeEditarPainel } from './autenticacao';

/**
 * A entrada de quem está na equipe.
 *
 * ── O bug ─────────────────────────────────────────────────────────────────
 *
 * Três pontos decidem se alguém entra como painel, e um deles usava outra
 * régua:
 *
 *   emitir o link   (`/api/auth/solicitar`)  → podeVerPainel  ✅
 *   validar sessão  (`sessaoAtual`)          → podeVerPainel  ✅
 *   trocar link por sessão (`/entrar/verificar`) → ehAdmin     ❌
 *
 * Quem está em `painel_acessos` recebia o link do painel, clicava, e era
 * **rebaixado a cliente**: `garantirConta` abria uma conta comum e o redirect
 * mandava para `/conta`. Com um pedido parado em `aguardando_pagamento`, a
 * área da conta só sabe oferecer a compra — e o link de acesso do time
 * terminava numa tela de pagamento.
 */

const DONO = 'dono@exemplo.com';
const DA_EQUIPE = 'equipe@exemplo.com';

beforeEach(() => {
  process.env.ADMIN_EMAIL = DONO;
  db.exec('DELETE FROM painel_acessos');
  db.prepare(
    `INSERT INTO painel_acessos (email, papel, nota, criado_por, criado_em)
     VALUES (?, 'leitor', 'Teste', ?, ?)`
  ).run(DA_EQUIPE, DONO, new Date().toISOString());
});

describe('quem pode ver o painel', () => {
  test('o dono e quem está na lista', () => {
    assert.equal(podeVerPainel(DONO), true);
    assert.equal(podeVerPainel(DA_EQUIPE), true);
  });

  test('estranho não', () => {
    assert.equal(podeVerPainel('ninguem@exemplo.com'), false);
  });

  /** Rebaixar não era proteção: quem separa ver de mexer é outra função. */
  test('ver não é mexer — só o dono edita', () => {
    assert.equal(podeEditarPainel(DONO), true);
    assert.equal(podeEditarPainel(DA_EQUIPE), false);
  });
});

describe('a troca do link por sessão', () => {
  const fonte = readFileSync('src/app/entrar/verificar/route.ts', 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    ''
  );

  test('usa a MESMA régua de quem emitiu o link', () => {
    assert.ok(
      /validado\.tipo === 'admin' && podeVerPainel\(validado\.email\)/.test(fonte),
      'com `ehAdmin` aqui, a equipe inteira vira cliente ao clicar no link'
    );
  });

  test('não sobrou `ehAdmin` decidindo o tipo da sessão', () => {
    assert.ok(!/ehAdmin\(/.test(fonte));
  });

  /** As duas pontas precisam concordar, ou o bug volta pelo outro lado. */
  test('quem emite o link também usa podeVerPainel', () => {
    const solicitar = readFileSync('src/app/api/auth/solicitar/route.ts', 'utf8');
    assert.ok(/podeVerPainel\(email\)/.test(solicitar));
  });
});
