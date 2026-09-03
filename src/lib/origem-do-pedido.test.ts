import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { utmJsonDoCorpo } from './rastreio';

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
  /**
   * A montagem do `utm_json` saiu de dentro de `/api/quiz` e virou
   * `utmJsonDoCorpo` — porque a outra rota que cria pedido (`/api/mini`, dos
   * funis `/familiar` e `/atravessar`) não tinha essa lógica e mandava venda
   * para a Utmify sem o anúncio que a trouxe.
   *
   * Testando a função em vez do texto do arquivo: o que importa é o que ela
   * aceita e o que ela corta, não em qual linha isso está escrito.
   */
  test('só as cinco chaves de UTM entram, e limitadas', () => {
    const bruto = utmJsonDoCorpo({
      utm_source: 'FB',
      utm_medium: 'CJ 01',
      utm_campaign: 'Aberto|1202502',
      utm_term: 'Instagram_Feed',
      utm_content: 'AD 04|12025',
      fbclid: 'PAcGRvZgJleHRu',
      qualquer_outra: 'não entra',
    });
    const lido = JSON.parse(bruto!);
    assert.deepEqual(Object.keys(lido).sort(), [
      'utm_campaign',
      'utm_content',
      'utm_medium',
      'utm_source',
      'utm_term',
    ]);
  });

  test('valor gigante é cortado em 120', () => {
    const lido = JSON.parse(utmJsonDoCorpo({ utm_campaign: 'x'.repeat(400) })!);
    assert.equal(lido.utm_campaign.length, 120);
  });

  test('sem UTM nenhum, nada é gravado', () => {
    assert.equal(utmJsonDoCorpo(null), null);
    assert.equal(utmJsonDoCorpo({}), null);
    assert.equal(utmJsonDoCorpo({ utm_source: '   ' }), null);
    assert.equal(utmJsonDoCorpo('nem objeto é'), null);
  });

  /**
   * As DUAS rotas que criam pedido precisam gravar. Esta é a que faltava, e
   * o buraco era silencioso: a venda chegava à Utmify sem `utm_content` e sem
   * `utm_term`, então a agência via a venda e não via qual criativo a trouxe.
   */
  test('as duas rotas de criação gravam utm_json', () => {
    for (const rota of ['src/app/api/quiz/route.ts', 'src/app/api/mini/route.ts']) {
      const fonte = codigoDe(rota);
      assert.match(fonte, /utm_json: utmJsonDoCorpo\(utm\)|utm_json: utmJson/, rota);
    }
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
