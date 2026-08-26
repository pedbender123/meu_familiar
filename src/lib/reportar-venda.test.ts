import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('nenhuma venda pode ficar invisível', () => {
  const fonte = codigoDe('src/lib/reportar-venda.ts');

  /**
   * ── A aposta que não se confirmou ──────────────────────────────────────
   *
   * A conta da Wiven é ligada à Utmify por dentro, então em 24/08 a venda
   * paga por lá deixou de ser reportada por nós, para não contar duas vezes.
   *
   * Não funcionou: a venda de R$ 18,90 do dia 24 não chegou à Utmify por
   * caminho nenhum — nem pelo deles, nem pelo nosso, que estava desligado
   * esperando o deles.
   *
   * Venda contada duas vezes é um número errado que alguém percebe e
   * conserta. Venda que não aparece em lugar nenhum é uma campanha avaliada
   * como se não tivesse vendido — e a decisão que sai disso é pausar o que
   * está funcionando.
   */
  test('por padrão, reportamos toda venda', () => {
    assert.match(fonte, /UTMIFY_PULAR_WIVEN !== '1'\) return false;/);
  });

  test('ainda dá para voltar atrás, se a integração deles passar a valer', () => {
    assert.match(fonte, /UTMIFY_PULAR_WIVEN/);
    assert.match(fonte, /gateway === 'wiven' && status === 'paid'/);
  });
});

describe('o envio nunca mais é silencioso', () => {
  const fonte = codigoDe('src/lib/utmify.ts');

  /**
   * Antes só a falha aparecia no log, então "nada no log" queria dizer duas
   * coisas opostas: deu certo, ou nem chegou a tentar. Foi essa ambiguidade
   * que fez a venda de 24/08 passar despercebida por dois dias.
   */
  test('o sucesso é logado, não só o erro', () => {
    assert.match(fonte, /\[utmify\] \$\{pedido\.status\} reportado/);
  });

  test('token vazio avisa em vez de sumir', () => {
    assert.match(fonte, /UTMIFY_API_TOKEN vazio/);
  });

  test('o erro diz de qual pedido', () => {
    assert.match(fonte, /falhou no pedido \$\{pedido\.orderId\}/);
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
