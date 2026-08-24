import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a mesma venda não pode ser contada duas vezes', () => {
  const fonte = codigoDe('src/lib/reportar-venda.ts');

  /**
   * A conta da Wiven é ligada à Utmify por dentro: venda paga por lá chega no
   * painel sozinha. Reportar também faria a mesma venda entrar por dois
   * caminhos — e sem dedup, porque a Utmify agrupa por `orderId` e o id da
   * Wiven não é o nosso `pedidoId`.
   *
   * O resultado seria receita inflada e campanha escalada por um número que
   * não existe. O oposto do motivo pelo qual a Utmify entrou: uma segunda via
   * CONFERÍVEL.
   */
  test('a venda PAGA da Wiven não é reportada por nós', () => {
    assert.match(fonte, /gateway === 'wiven' && status === 'paid'/);
    assert.match(fonte, /if \(gatewayJaReportaSozinho\(pedido\.gateway, status\)\)/);
  });

  /**
   * A Wiven não manda o pré-venda, e é ele que dá o denominador: sem
   * `waiting_payment` o painel mostra as vendas e nada de quem chegou ao
   * checkout e desistiu. Não existe taxa de conversão com numerador só.
   */
  test('o pré-venda vai sempre, inclusive na Wiven', () => {
    assert.doesNotMatch(fonte, /return gateway === 'wiven';/);
    assert.match(fonte, /status === 'paid'/);
  });

  /** Duas fontes é ruim; nenhuma é pior. A escotilha existe. */
  test('dá para forçar o envio se a integração nativa falhar', () => {
    assert.match(fonte, /UTMIFY_REPORTAR_WIVEN === '1'/);
  });

  /** Mercado Pago e Cakto não têm essa ligação — nesses, quem reporta somos nós. */
  test('só a Wiven é pulada', () => {
    assert.doesNotMatch(fonte, /gateway === 'mercadopago'\s*\|\|/);
  });
});

describe('o painel da Utmify não pode mentir sobre quem cobrou', () => {
  /**
   * `platform` estava fixo em `'Cakto'`, de quando a Cakto era o plano. Com o
   * Mercado Pago cobrando, TODA venda aparecia no painel dela como se fosse
   * da Cakto — que nunca cobrou um centavo.
   */
  test('a plataforma sai do gateway do pedido', () => {
    const fonte = codigoDe('src/lib/reportar-venda.ts');
    assert.match(fonte, /plataforma: plataformaDe\(pedido\.gateway\)/);
    assert.match(fonte, /gateway === 'wiven'\) return 'Wiven'/);
    assert.match(fonte, /gateway === 'mercadopago'\) return 'MercadoPago'/);
  });

  test('a constante antiga não decide mais nada sozinha', () => {
    const fonte = codigoDe('src/lib/utmify.ts');
    assert.match(fonte, /pedido\.plataforma \?\?/);
    assert.doesNotMatch(fonte, /platform: process\.env\.UTMIFY_PLATAFORMA \?\? 'Cakto'/);
  });
});

describe('o pixel da Utmify', () => {
  const fonte = codigoDe('src/components/ScriptUtmify.tsx');

  /** Sem pixel configurado não há script morto na página nem erro no console. */
  test('sem pixel, nada é carregado', () => {
    assert.match(fonte, /if \(!pixel\) return null;/);
  });

  /**
   * O snippet que a Utmify entrega é ofuscado (base64 + XOR) e faz exatamente
   * isto: define `window.pixelId` e carrega o mesmo CDN. Colar código
   * ofuscado num projeto é aceitar uma caixa-preta que pode mudar sem aviso
   * na próxima vez que for copiada.
   */
  test('o pixel vai por variável, não embutido no código', () => {
    assert.match(fonte, /process\.env\.NEXT_PUBLIC_UTMIFY_PIXEL_ID/);
    assert.match(fonte, /window\.pixelId = \$\{JSON\.stringify\(pixel\)\}/);
    assert.doesNotMatch(fonte, /atob|eval|fromCharCode/);
  });
});
