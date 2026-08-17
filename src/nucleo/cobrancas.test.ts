import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import db from '../lib/db';
import '../lib/autenticacao';
import {
  abrirCobranca,
  buscarCobranca,
  confirmarPagamento,
  anotarPagamento,
  buscarCobrancaPorPagamento,
} from './cobrancas';
import { assinaturasAtivasDaConta } from './assinaturas';
import { direitosEfetivos } from './acesso';
import { PRODUTOS } from '../lib/produtos';

beforeEach(() => {
  db.exec('DELETE FROM cobrancas');
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM contas');
});

function conta(): { id: string; email: string } {
  const id = randomUUID();
  const email = `${id}@teste.com`;
  db.prepare('INSERT INTO contas (id, email, criado_em) VALUES (?, ?, ?)').run(
    id,
    email,
    new Date().toISOString()
  );
  return { id, email };
}

describe('abrirCobranca', () => {
  test('o valor vem do PLANO, não de quem chamou', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;
    const plano = db
      .prepare(`SELECT preco_centavos FROM planos WHERE id = 'revelacao_mensal'`)
      .get() as { preco_centavos: number };

    assert.equal(aberta.cobranca.valor_centavos, plano.preco_centavos);
  });

  test('nasce aguardando pagamento, sem assinatura', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;
    assert.equal(aberta.cobranca.status, 'aguardando_pagamento');
    assert.equal(aberta.cobranca.assinatura_id, null);
    assert.equal(assinaturasAtivasDaConta(c.id).length, 0, 'assinatura só nasce no pagamento');
  });

  test('plano inexistente devolve null em vez de cobrar do nada', () => {
    const c = conta();
    assert.equal(abrirCobranca({ contaId: c.id, email: c.email, planoId: 'nao-existe' }), null);
  });

  test('plano GRÁTIS não gera cobrança — R$ 0,00 seria recusado pelo gateway', () => {
    const c = conta();
    assert.equal(abrirCobranca({ contaId: c.id, email: c.email, planoId: 'gratuito' }), null);
  });

  test('plano fora da vitrine não é vendável por link direto', () => {
    const c = conta();
    // `completa` é avulso antigo: ativo pra quem tem, mas publico = 0.
    assert.equal(abrirCobranca({ contaId: c.id, email: c.email, planoId: 'completa' }), null);
  });
});

describe('confirmarPagamento', () => {
  test('cria a assinatura e marca a cobrança como paga', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;

    const r = confirmarPagamento(aberta.cobranca.id, { metodo: 'pix', brutoCentavos: 1590 })!;
    assert.equal(r.cobranca.status, 'pago');
    assert.ok(r.assinatura);
    assert.equal(r.cobranca.assinatura_id, r.assinatura!.id);
    assert.equal(assinaturasAtivasDaConta(c.id).length, 1);
  });

  test('a assinatura nasce com prazo — plano mensal dá 30 dias', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;
    const r = confirmarPagamento(aberta.cobranca.id)!;

    assert.ok(r.assinatura!.fim, 'assinatura de plano com prazo não pode ser eterna');
    const dias = Math.round(
      (new Date(r.assinatura!.fim!).getTime() - new Date(r.assinatura!.inicio).getTime()) / 86_400_000
    );
    assert.equal(dias, 30);
  });

  /**
   * O Mercado Pago reenvia a notificação quando não recebe 200 rápido o
   * bastante. Sem idempotência, o reenvio daria um segundo mês de graça — e
   * pior, silenciosamente.
   */
  test('webhook reenviado NÃO cria segunda assinatura', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'acompanhamento_mensal' })!;

    const primeira = confirmarPagamento(aberta.cobranca.id, { metodo: 'pix' })!;
    const segunda = confirmarPagamento(aberta.cobranca.id, { metodo: 'pix' })!;

    assert.equal(primeira.assinatura!.id, segunda.assinatura!.id, 'tem que ser a MESMA');
    assert.equal(assinaturasAtivasDaConta(c.id).length, 1);
  });

  test('o segundo webhook não sobrescreve o financeiro do primeiro', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;

    confirmarPagamento(aberta.cobranca.id, { metodo: 'pix', brutoCentavos: 1590, taxaCentavos: 15 });
    confirmarPagamento(aberta.cobranca.id, { metodo: 'outro', brutoCentavos: 99 });

    const final = buscarCobranca(aberta.cobranca.id)!;
    assert.equal(final.metodo, 'pix');
    assert.equal(final.bruto_centavos, 1590);
  });

  test('guarda o financeiro que o gateway informou', () => {
    const c = conta();
    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;
    confirmarPagamento(aberta.cobranca.id, {
      metodo: 'pix',
      brutoCentavos: 1590,
      taxaCentavos: 16,
      liquidoCentavos: 1574,
    });

    const final = buscarCobranca(aberta.cobranca.id)!;
    assert.equal(final.taxa_centavos, 16);
    assert.equal(final.liquido_centavos, 1574);
  });

  test('cobrança inexistente devolve null em vez de lançar', () => {
    assert.equal(confirmarPagamento(randomUUID()), null);
  });

  test('pagar dá os direitos do plano de verdade', () => {
    const c = conta();
    assert.equal(direitosEfetivos(c.id, c.email).leiturasPorMes, 0);

    const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'acompanhamento_mensal' })!;
    confirmarPagamento(aberta.cobranca.id);

    const d = direitosEfetivos(c.id, c.email);
    assert.ok(d.leiturasPorMes > 0);
    assert.equal(d.relatorioCompleto, true);
    assert.equal(d.conselhoDiario, true);
  });
});

test('anotarPagamento deixa o webhook reencontrar a cobrança pelo id do gateway', () => {
  const c = conta();
  const aberta = abrirCobranca({ contaId: c.id, email: c.email, planoId: 'revelacao_mensal' })!;

  anotarPagamento(aberta.cobranca.id, 'mp-12345');
  assert.equal(buscarCobrancaPorPagamento('mp-12345')?.id, aberta.cobranca.id);
});

/**
 * A invariante do modelo novo: a Revelação virou a porta de entrada, e uma
 * porta com preço não é porta. Se alguém puser preço nela de novo sem
 * pensar, o funil grátis inteiro (que pula o gateway justamente por o preço
 * ser zero) volta a cobrar em silêncio.
 */
test('a Revelação é grátis — o funil de entrada depende disso', () => {
  assert.equal(PRODUTOS.revelacao.precoCentavos, 0);
});
