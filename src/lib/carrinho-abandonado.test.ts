import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import db, { pedidosAbandonados, marcarLembretePorEmail } from './db';

/**
 * Recuperação de carrinho — um lembrete por PESSOA.
 *
 * ── O que isto trava ──────────────────────────────────────────────────────
 *
 * A consulta devolvia uma linha por carrinho. Em 22/08 uma pessoa refez o
 * ritual três vezes em 80 minutos e outra apareceu duas vezes só porque
 * digitou o e-mail com maiúsculas diferentes — as duas receberiam um e-mail
 * por tentativa.
 *
 * O script já dizia a regra em comentário: "quem não quis não vai querer no
 * terceiro, vai só marcar como spam — e aí o domínio inteiro paga o preço,
 * inclusive os e-mails de entrega que as pessoas esperam". Faltava o código
 * cumprir.
 */

function criar(email: string, horasAtras: number) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO pedidos (id, nome, email, respostas_json, familiar, lua, status, criado_em, atualizado_em, produto)
     VALUES (?, 'Teste', ?, '{}', 'coruja', 'nova', 'aguardando_pagamento', ?, ?, 'revelacao')`
  ).run(
    id,
    email,
    new Date(Date.now() - horasAtras * 3_600_000).toISOString(),
    new Date().toISOString()
  );
  return id;
}

beforeEach(() => db.exec("DELETE FROM pedidos"));

describe('a fila de lembretes', () => {
  test('três carrinhos da mesma pessoa viram um lembrete só', () => {
    criar('ana@exemplo.com', 40);
    criar('ana@exemplo.com', 38);
    criar('ana@exemplo.com', 37);
    assert.equal(pedidosAbandonados().length, 1);
  });

  /** O mesmo endereço com caixa diferente é a mesma pessoa. */
  test('maiúsculas não criam uma segunda pessoa', () => {
    criar('Cris@Exemplo.com', 30);
    criar('cris@exemplo.com', 28);
    assert.equal(pedidosAbandonados().length, 1);
  });

  test('pessoas diferentes continuam recebendo cada uma a sua', () => {
    criar('ana@exemplo.com', 30);
    criar('bia@exemplo.com', 30);
    assert.equal(pedidosAbandonados().length, 2);
  });

  /** O link do lembrete leva ao que ela estava tentando comprar por último. */
  test('fica o carrinho mais recente da pessoa', () => {
    criar('ana@exemplo.com', 60);
    const recente = criar('ana@exemplo.com', 30);
    assert.equal(pedidosAbandonados()[0].id, recente);
  });

  /**
   * A espera é de 24h porque o Pix gerado vale até o dia seguinte. Lembrar
   * antes disso é apressar quem já decidiu — e gastar o cupom de resgate com
   * quem ia pagar sozinho.
   */
  test('fora da janela de 24h a 72h, ninguém entra', () => {
    criar('cedo@exemplo.com', 2);
    criar('ainda-quente@exemplo.com', 20);
    criar('tarde@exemplo.com', 100);
    assert.equal(pedidosAbandonados().length, 0);
  });

  test('com 24h cumpridas, entra', () => {
    criar('pronta@exemplo.com', 25);
    assert.equal(pedidosAbandonados().length, 1);
  });

  test('pedido sem e-mail não entra — não há para onde mandar', () => {
    const id = criar('x@exemplo.com', 30);
    db.prepare('UPDATE pedidos SET email = ? WHERE id = ?').run('', id);
    assert.equal(pedidosAbandonados().length, 0);
  });
});

describe('marcar como lembrada', () => {
  /**
   * Deduplicar sem isto não resolve nada: a rodada seguinte acharia o segundo
   * carrinho da mesma pessoa e mandaria o segundo e-mail.
   */
  test('marcar por e-mail tira a fila inteira daquela pessoa', () => {
    criar('ana@exemplo.com', 40);
    criar('ana@exemplo.com', 38);
    criar('ana@exemplo.com', 37);

    assert.equal(marcarLembretePorEmail('ana@exemplo.com'), 3);
    assert.equal(pedidosAbandonados().length, 0, 'nenhuma volta na próxima rodada');
  });

  test('não mexe na fila de outra pessoa', () => {
    criar('ana@exemplo.com', 30);
    criar('bia@exemplo.com', 30);
    marcarLembretePorEmail('ana@exemplo.com');
    assert.deepEqual(
      pedidosAbandonados().map((p) => p.email),
      ['bia@exemplo.com']
    );
  });
});
