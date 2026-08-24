import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * O CÓDIGO, sem os comentários — os comentários deste checkout citam o
 * booleano antigo (`pixNoBrick`) e a regra que ele substituiu, e um teste que
 * lê fonte precisa ler só o que executa.
 */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('o checkout começa no Pix', () => {
  /**
   * A regra de 23/08: cartão numa compra de impulso de R$ 9,80 pede cinco
   * campos e a carteira na mão, depois de treze minutos de ritual. Pix é um
   * botão. Quem não escolhe cai no caminho curto.
   *
   * Isto é uma linha fácil de inverter sem querer numa refatoração, e o
   * sintoma seria invisível: a tela continua funcionando e vendendo menos.
   */
  test('o meio nasce em pix', () => {
    const fonte = codigoDe('src/components/checkout/Checkout.tsx');
    assert.match(fonte, /useState<MeioEscolhido>\('pix'\)/);
  });

  test('o cartão continua a um clique, não escondido', () => {
    const fonte = codigoDe('src/components/checkout/Checkout.tsx');
    assert.match(fonte, /escolher\('cartao'\)/);
  });
});

describe('um Brick de cada vez', () => {
  /**
   * O Brick monta dentro de `#brick-pagamento`, que é um só no DOM. Sem o
   * `key` por meio, trocar de aba reaproveitaria a mesma instância de React,
   * o efeito não rodaria de novo (`jaMontou` já é `true`) e a aba nova
   * mostraria o Brick da aba velha — cartão cobrando na tela do Pix.
   */
  test('o Brick recebe só o meio escolhido', () => {
    const fonte = codigoDe('src/components/checkout/Checkout.tsx');
    assert.match(fonte, /meios=\{\[meio\]\}/);
  });

  test('a troca de aba remonta o Brick', () => {
    const fonte = codigoDe('src/components/checkout/Checkout.tsx');
    assert.match(fonte, /key=\{`mp-\$\{meio\}`\}/);
  });

  /**
   * `pixNoBrick` era booleano porque a única pergunta era "o Pix é da Cakto?".
   * Booleano não expressa "só cartão" — e foi por isso que virou lista. Se
   * alguém ressuscitar o booleano, o seletor perde a metade do cartão.
   */
  test('o Brick lê a lista de meios, não o booleano antigo', () => {
    const fonte = codigoDe('src/components/checkout/MercadoPago.tsx');
    assert.doesNotMatch(fonte, /pixNoBrick/);
    assert.match(fonte, /creditCard: meios\.includes\('cartao'\)/);
    assert.match(fonte, /bankTransfer: meios\.includes\('pix'\)/);
  });
});

describe('a tela não decide quem cobra', () => {
  /**
   * `gatewayDe()` roda no servidor a cada visita, e trocar o Pix de gateway é
   * um restart — não um deploy. Se o componente do navegador lesse
   * `process.env`, a troca voltaria a exigir build, e o momento em que a
   * gente vai querer voltar atrás é justamente o pior momento para buildar.
   */
  test('o Checkout recebe o gateway pronto, sem ler ambiente', () => {
    const fonte = codigoDe('src/components/checkout/Checkout.tsx');
    assert.doesNotMatch(fonte, /process\.env/);
    assert.match(fonte, /gatewayPix/);
    assert.match(fonte, /gatewayCartao/);
  });

  test('a tela de pagamento resolve os dois meios no servidor', () => {
    const fonte = codigoDe('src/app/pagamento/[id]/page.tsx');
    assert.match(fonte, /gatewayDe\('pix', campanha\)/);
    assert.match(fonte, /gatewayDe\('cartao', campanha\)/);
    // A campanha sai do PEDIDO, nunca da URL da requisição: origem mandada
    // pelo cliente seria o cliente escolhendo em que conta o dinheiro cai.
    assert.match(fonte, /campanhaDoPedido\(pedido\)/);
  });
});
