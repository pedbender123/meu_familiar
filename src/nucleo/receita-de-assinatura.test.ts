import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import db from '../lib/db';
import { buscarCobranca, registrarRenovacao, type Cobranca } from './cobrancas';
import { relatorioDoPeriodo } from '../lib/campanhas';

/**
 * A receita de assinatura, do lugar onde ela nasce até a tela onde ela aparece.
 *
 * ── O dia que produziu estes testes ───────────────────────────────────────
 *
 * 01/09: a primeira assinatura paga de verdade entrou, e não estava em tela
 * nenhuma do painel. Não era um bug — era a consequência de `cobrancas` ter
 * nascido fora do funil, quando assinatura era uma venda de dentro do app.
 *
 * Cada teste aqui é um dos quatro buracos daquele dia.
 */

const AGORA = '2026-09-15T12:00:00.000Z';
const DE = '2026-09-01T00:00:00.000Z';
const ATE = '2026-10-01T00:00:00.000Z';

beforeEach(() => {
  db.exec('DELETE FROM cobrancas');
  db.exec('DELETE FROM pedidos');
  db.exec('DELETE FROM visitas');
});

function semearCobranca(campos: Partial<Cobranca> & { id: string }): Cobranca {
  db.prepare(
    `INSERT INTO cobrancas (id, conta_id, email, plano_id, valor_centavos, status,
       pagamento_id, metodo, bruto_centavos, taxa_centavos, assinatura_id,
       assinatura_externa_id, campanha_id, peca_id, origem, utm_json,
       renovacao_de, pago_em, criado_em, atualizado_em)
     VALUES (@id, @conta_id, @email, @plano_id, @valor_centavos, @status,
       @pagamento_id, @metodo, @bruto_centavos, @taxa_centavos, @assinatura_id,
       @assinatura_externa_id, @campanha_id, @peca_id, @origem, @utm_json,
       @renovacao_de, @pago_em, @criado_em, @atualizado_em)`
  ).run({
    conta_id: 'conta1',
    email: 'quem@assinou.com',
    plano_id: 'mensal',
    valor_centavos: 2990,
    status: 'pago',
    pagamento_id: null,
    metodo: 'credit_card',
    bruto_centavos: null,
    taxa_centavos: null,
    assinatura_id: 'ass1',
    assinatura_externa_id: null,
    campanha_id: null,
    peca_id: null,
    origem: null,
    utm_json: null,
    renovacao_de: null,
    pago_em: AGORA,
    criado_em: AGORA,
    atualizado_em: AGORA,
    ...campos,
  });
  return buscarCobranca(campos.id)!;
}

describe('a renovação vira uma linha de receita', () => {
  /**
   * Antes disto, o segundo mês empurrava `assinaturas.fim` e sumia. Um
   * assinante de seis meses tinha uma única linha de dinheiro no banco.
   */
  test('nasce herdando a atribuição da cobrança original', () => {
    const original = semearCobranca({
      id: 'cob1',
      campanha_id: 'camp1',
      peca_id: 'peca1',
      origem: 'instagram',
      utm_json: '{"utm_campaign":"120248890724340044"}',
    });

    const nova = registrarRenovacao(original, {
      transacaoExterna: 'tx-mes-2',
      brutoCentavos: 2990,
      taxaCentavos: 348,
      quando: new Date(AGORA),
    });

    assert.ok(nova);
    assert.equal(nova.renovacao_de, 'cob1');
    assert.equal(nova.status, 'pago');
    assert.equal(nova.campanha_id, 'camp1');
    assert.equal(nova.peca_id, 'peca1');
    assert.equal(nova.origem, 'instagram');
    assert.equal(nova.utm_json, '{"utm_campaign":"120248890724340044"}');
    assert.equal(nova.bruto_centavos, 2990);
  });

  /**
   * A Wiven reenvia o webhook até receber 200. A mesma transação não pode
   * virar duas linhas de receita — é o mesmo erro que deu 120 dias de acesso
   * por um pagamento, visto do lado do dinheiro.
   */
  test('reenvio do webhook não vira receita dobrada', () => {
    const original = semearCobranca({ id: 'cob1' });
    const p = { transacaoExterna: 'tx-mes-2', quando: new Date(AGORA) };

    assert.ok(registrarRenovacao(original, p));
    assert.equal(registrarRenovacao(original, p), null);

    const n = db.prepare(`SELECT COUNT(*) c FROM cobrancas`).get() as { c: number };
    assert.equal(n.c, 2, 'a original mais uma renovação, e nada além');
  });

  /**
   * O terceiro mês chega quando a linha mais recente já é uma renovação. Se
   * ele apontasse para ela, `renovacao_de` viraria uma corrente em vez de uma
   * chave — e separar "recorrente" de "primeira venda" passaria a exigir
   * percorrer a cadeia inteira.
   */
  test('renovação de renovação aponta para a cobrança raiz', () => {
    const original = semearCobranca({ id: 'cob1' });
    const mes2 = registrarRenovacao(original, { transacaoExterna: 'tx2' })!;
    const mes3 = registrarRenovacao(mes2, { transacaoExterna: 'tx3' })!;

    assert.equal(mes3.renovacao_de, 'cob1');
  });

  /**
   * `cobrancaDoContrato` procura o contrato e pega a cobrança mais recente.
   * Se a renovação carregasse o contrato, ela acharia a si mesma no mês
   * seguinte, e a cadeia se perderia.
   */
  test('a renovação não carrega o contrato do gateway', () => {
    const original = semearCobranca({ id: 'cob1', assinatura_externa_id: 'contrato-x' });
    const nova = registrarRenovacao(original, { transacaoExterna: 'tx2' })!;
    assert.equal(nova.assinatura_externa_id, null);
  });

  test('sem transação não há renovação', () => {
    const original = semearCobranca({ id: 'cob1' });
    assert.equal(registrarRenovacao(original, { transacaoExterna: '' }), null);
  });
});

describe('a assinatura aparece no relatório', () => {
  test('a Central conta a primeira cobrança e as renovações separadas', () => {
    const original = semearCobranca({ id: 'cob1', bruto_centavos: 2990, taxa_centavos: 348 });
    registrarRenovacao(original, {
      transacaoExterna: 'tx2',
      brutoCentavos: 2990,
      taxaCentavos: 348,
      quando: new Date(AGORA),
    });

    const r = relatorioDoPeriodo(DE, ATE, 1440);
    assert.equal(r.assinaturasNovas, 1);
    assert.equal(r.renovacoes, 1);
    assert.equal(r.receitaRecorrenteCentavos, 5980);
    assert.equal(r.taxaRecorrenteCentavos, 696);
  });

  /**
   * O que a atribuição serve para impedir: creditar a uma campanha dinheiro
   * que não se sabe de onde veio. Cobrança sem `campanha_id` — toda a que é
   * anterior à migração 038 — não aparece em campanha nenhuma.
   */
  test('só entra na campanha quem chegou marcado com ela', () => {
    semearCobranca({ id: 'daCampanha', campanha_id: 'camp1', bruto_centavos: 2990 });
    semearCobranca({ id: 'semMarca', campanha_id: null, bruto_centavos: 1890 });
    semearCobranca({ id: 'deOutra', campanha_id: 'camp2', bruto_centavos: 4990 });

    const daCampanha = relatorioDoPeriodo(DE, ATE, 1440, 'camp1');
    assert.equal(daCampanha.assinaturasNovas, 1);
    assert.equal(daCampanha.receitaRecorrenteCentavos, 2990);

    const central = relatorioDoPeriodo(DE, ATE, 1440);
    assert.equal(central.assinaturasNovas, 3, 'na Central tudo aparece');
    assert.equal(central.receitaRecorrenteCentavos, 2990 + 1890 + 4990);
  });

  /**
   * A receita cai na janela em que o dinheiro entrou, não naquela em que a
   * cobrança nasceu. A renovação de um contrato de seis meses atrás é
   * dinheiro de hoje — e a cobrança aberta ontem e paga hoje também.
   */
  test('a data que conta é a do pagamento', () => {
    semearCobranca({
      id: 'antiga',
      criado_em: '2026-03-01T00:00:00.000Z',
      pago_em: AGORA,
      bruto_centavos: 2990,
    });
    semearCobranca({
      id: 'foraDaJanela',
      criado_em: AGORA,
      pago_em: '2026-10-20T00:00:00.000Z',
      bruto_centavos: 9900,
    });

    const r = relatorioDoPeriodo(DE, ATE, 1440);
    assert.equal(r.assinaturasNovas, 1);
    assert.equal(r.receitaRecorrenteCentavos, 2990);
  });

  test('cobrança não paga não vira receita', () => {
    semearCobranca({ id: 'aberta', status: 'aguardando_pagamento', pago_em: null });
    const r = relatorioDoPeriodo(DE, ATE, 1440);
    assert.equal(r.assinaturasNovas, 0);
    assert.equal(r.receitaRecorrenteCentavos, 0);
  });

  /**
   * O valor de tabela só entra quando o gateway não disse quanto cobrou. Se a
   * ordem invertesse, mudar o preço do plano reescreveria a receita de todos
   * os meses já cobrados.
   */
  test('vale o que o gateway cobrou, não o preço de tabela', () => {
    semearCobranca({ id: 'cob1', valor_centavos: 3990, bruto_centavos: 2990 });
    const r = relatorioDoPeriodo(DE, ATE, 1440);
    assert.equal(r.receitaRecorrenteCentavos, 2990);
  });
});

describe('a venda de assinatura chega à UTMify', () => {
  /**
   * O ramo da cobrança RETORNA antes de chegar ao `reportarVenda` do pedido.
   * Enquanto ninguém reparou nisso, nenhuma assinatura foi reportada — nem a
   * primeira, nem as seguintes.
   */
  test('o webhook reporta a primeira cobrança e a renovação', () => {
    const fonte = readFileSync('src/lib/webhook-pagamento.ts', 'utf8');

    const naRenovacao = fonte.indexOf('registrarRenovacao');
    const relatoDaRenovacao = fonte.indexOf("reportarAssinatura(linha, 'paid'");
    assert.ok(naRenovacao > 0, 'a renovação vira linha de receita');
    assert.ok(
      relatoDaRenovacao > naRenovacao,
      'e é reportada DEPOIS de existir — sem a linha não há orderId para mandar'
    );

    assert.match(
      fonte,
      /reportarAssinatura\(confirmada\?\.cobranca \?\? cobranca, 'paid'/,
      'a primeira cobrança também é reportada'
    );
  });

  /**
   * O par `waiting_payment` + `paid` é o que dá o denominador da conversão no
   * painel deles. Só a venda paga faria a campanha aparecer convertendo 100%
   * de um funil que ninguém vê.
   */
  test('a intenção de assinar também é reportada', () => {
    const fonte = readFileSync('src/app/api/cobranca/[id]/pagamento/route.ts', 'utf8');
    assert.match(fonte, /reportarAssinatura\([\s\S]{0,80}'waiting_payment'/);
  });

  /**
   * O `orderId` é o da COBRANÇA. Fosse o da assinatura, a UTMify agruparia os
   * seis meses num pedido só e cada renovação sobrescreveria a anterior.
   */
  test('cada mês entra como um pedido próprio', () => {
    const fonte = readFileSync('src/lib/reportar-assinatura.ts', 'utf8');
    assert.match(fonte, /orderId: cobranca\.id/);
  });
});
