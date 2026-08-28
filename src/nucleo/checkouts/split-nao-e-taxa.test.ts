import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { traduzirWebhook } from './wiven';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('repasse não é taxa', () => {
  /**
   * ── O caso real de 27/08 ────────────────────────────────────────────────
   *
   * Venda de R$ 18,90 pela Wiven, com split de 40% e 20% configurado.
   * A Wiven devolveu `commissionAmount: 6.33` — o que sobrou para quem
   * cobrou, já sem a taxa DELES e sem os splits.
   *
   * Como a taxa era deduzida por subtração (bruto − líquido), ela apareceu
   * como **R$ 12,57** numa venda de R$ 18,90: 66% de custo de gateway. Os
   * R$ 9,44 repassados ao João e ao Pedro tinham virado "taxa".
   *
   * O estrago era duplo: o painel financeiro mostrava esse custo, e a Utmify
   * recebia o mesmo número como `gatewayFee` — afundando o lucro da campanha,
   * que é justamente onde se decide escalar ou pausar.
   */
  test('a tradução crua ainda soma tudo — é o esperado dela', () => {
    const r = traduzirWebhook({
      event: 'TRANSACTION_PAID',
      transaction: {
        id: 'tx', identifier: 'ped--1', status: 'COMPLETED',
        paymentMethod: 'PIX', amount: 18.9, commissionAmount: 6.33,
      },
    });
    assert.equal(r.brutoCentavos, 1890);
    assert.equal(r.liquidoCentavos, 633);
    assert.equal(r.taxaCentavos, 1257, 'sozinha, a subtração engole o split');
  });

  /**
   * Quem separa é o webhook, com o valor gravado na cobrança. 1257 − 944
   * devolve os R$ 3,13 que a Wiven realmente cobrou.
   */
  test('o webhook desconta o repasse gravado no pedido', () => {
    const fonte = codigoDe('src/app/api/webhook/wiven/route.ts');
    assert.match(fonte, /pedidoDaVenda\?\.split_centavos \?\? 0/);
    assert.match(fonte, /resultado\.taxaCentavos - splitCentavos/);
    assert.match(fonte, /Math\.max\(/, 'taxa negativa nunca');
  });

  /**
   * O split é gravado na COBRANÇA. Recalcular no webhook leria a configuração
   * de então — mudar o percentual reescreveria a contabilidade de vendas
   * antigas sem ninguém pedir. Fato consumado se grava.
   */
  test('o repasse é gravado quando a cobrança sai', () => {
    const rota = codigoDe('src/app/api/pedido/[id]/pagamento/route.ts');
    assert.match(rota, /split_centavos: resultado\.splitCentavos/);
    const w = codigoDe('src/nucleo/checkouts/wiven.ts');
    assert.match(w, /splitCentavos: splits\.reduce/);
  });

  /** Sem split, nada muda: a taxa continua sendo a subtração inteira. */
  test('venda sem split segue igual', () => {
    const r = traduzirWebhook({
      event: 'TRANSACTION_PAID',
      transaction: {
        id: 'tx', identifier: 'ped--1', status: 'COMPLETED',
        paymentMethod: 'PIX', amount: 18.9, commissionAmount: 15.78,
      },
    });
    assert.equal(r.taxaCentavos, 312);
  });
});
