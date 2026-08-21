import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { montarCorpo, statusLiberaAcesso, METODOS_HABILITADOS } from './directpag';

/**
 * O adaptador é o caminho do dinheiro. O que se trava aqui é o que, se
 * quebrar, cobra o valor errado ou entrega sem receber.
 */

const PRODUTO = { id: 'revelacao', descricao: 'Revelação', precoCentavos: 1490 };

const BASE = {
  metodo: 'pix' as const,
  pagador: {
    nome: 'Helena',
    email: 'helena@exemplo.com',
    telefone: '(21) 99999-9999',
    documento: '091.157.510-31',
  },
  produto: PRODUTO,
  pedidoId: 'ped-123',
  descontoPercentual: 0,
};

describe('o valor cobrado', () => {
  test('sai do produto, em centavos', () => {
    assert.equal(montarCorpo(BASE).amount, 1490);
  });

  test('o cupom é aplicado no servidor, não pelo cliente', () => {
    assert.equal(montarCorpo({ ...BASE, descontoPercentual: 20 }).amount, 1192);
  });

  /**
   * O arredondamento é para CIMA de propósito: centavo a menos no nosso bolso
   * é irrelevante, centavo a mais é cobrança indevida.
   */
  test('arredonda para cima, nunca cobrando a mais', () => {
    const corpo = montarCorpo({ ...BASE, descontoPercentual: 33 });
    assert.equal(corpo.amount, Math.ceil(1490 * 0.67));
  });
});

describe('a referência do pedido', () => {
  /**
   * Vai em dois campos porque a documentação do DirectPag não garante qual
   * volta no postback — e pagamento órfão é gente que pagou e não recebeu.
   */
  test('viaja em `external_reference` E em `metadata`', () => {
    const corpo = montarCorpo(BASE);
    assert.equal(corpo.external_reference, 'ped-123');
    assert.equal(corpo.metadata.pedido_id, 'ped-123');
  });
});

describe('o pagador', () => {
  test('telefone e documento vão só com números', () => {
    const c = montarCorpo(BASE);
    assert.equal(c.customer.phone_number, '21999999999');
    assert.equal(c.customer.document, '09115751031');
  });
});

describe('o cartão', () => {
  test('não vai no corpo quando o método não é cartão', () => {
    assert.equal('card' in montarCorpo(BASE), false);
  });

  /**
   * Desligado por padrão: a API recebe o número em texto, sem tokenização, o
   * que move a operação de SAQ A para SAQ D no PCI-DSS. Ligar é uma decisão
   * consciente, não um padrão herdado.
   */
  test('cartão não está habilitado por padrão', () => {
    assert.equal(METODOS_HABILITADOS.includes('credit_card'), false);
    assert.deepEqual([...METODOS_HABILITADOS].sort(), ['billet', 'pix']);
  });
});

describe('o que libera a entrega', () => {
  test('só status conhecidos de pagamento confirmado', () => {
    assert.ok(statusLiberaAcesso('paid'));
    assert.ok(statusLiberaAcesso('approved'));
    assert.ok(statusLiberaAcesso('PAID'), 'não é sensível a caixa');
  });

  /**
   * Lista de permissão, não de negação: um status novo que o gateway invente
   * amanhã não pode liberar entrega por omissão. Errar para o lado de não
   * entregar é recuperável pela reconciliação; o contrário, não.
   */
  test('nada além disso libera — nem status inventado', () => {
    for (const s of ['pending', 'canceled', 'refunded', 'chargeback', 'novo_status']) {
      assert.equal(statusLiberaAcesso(s), false, `${s} não pode liberar`);
    }
  });
});
