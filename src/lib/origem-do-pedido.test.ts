import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a origem é gravada quando o pedido nasce', () => {
  /**
   * O furo medido em 24/08: **zero pedidos com campanha no banco**, com
   * campanha rodando havia dias.
   *
   * A origem só era gravada na tentativa de pagamento, e só pelos checkouts
   * de Cakto e Wiven — o Brick do Mercado Pago, que é quem está cobrando,
   * nunca mandou nada. Quebrava duas coisas: a Utmify via toda venda como
   * direta, e o roteamento por campanha não tinha o que rotear.
   *
   * E precisa ser no nascimento, não no pagamento: a tela de checkout escolhe
   * qual gateway mostrar ANTES de qualquer POST de cobrança existir.
   */
  test('o ritual manda a origem junto das respostas', () => {
    const fonte = codigoDe('src/app/ritual/RitualCliente.tsx');
    assert.match(fonte, /utm: utmsDaSessao\(\)/);
  });

  test('a rota do quiz grava utm_json no pedido', () => {
    const fonte = codigoDe('src/app/api/quiz/route.ts');
    assert.match(fonte, /utm_json: utmJson/);
  });

  /**
   * O campo passou a ter poder de decisão — é dele que sai a campanha que
   * escolhe o gateway. Aceitar qualquer chave de qualquer tamanho seria
   * deixar o cliente escrever no nosso banco.
   */
  test('só as cinco chaves de UTM entram, e limitadas', () => {
    const fonte = codigoDe('src/app/api/quiz/route.ts');
    assert.match(fonte, /'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'/);
    assert.match(fonte, /typeof valor === 'string'/);
    assert.match(fonte, /slice\(0, 120\)/);
  });

  /** Segunda chance para quem apagou o armazenamento no meio do caminho. */
  test('o checkout do Mercado Pago também manda', () => {
    const fonte = codigoDe('src/components/checkout/MercadoPago.tsx');
    assert.match(fonte, /utm: utmsDaSessao\(\)/);
  });

  test('criarPedido aceita e persiste a coluna', () => {
    const fonte = codigoDe('src/lib/db.ts');
    assert.match(fonte, /utm_json\?: string \| null;/);
    assert.match(fonte, /indicado_por, funil, utm_json, status/);
    assert.match(fonte, /@indicado_por, @funil, @utm_json, 'aguardando_pagamento'/);
  });
});
