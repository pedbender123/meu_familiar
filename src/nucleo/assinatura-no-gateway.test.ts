import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * A assinatura cobra pelo MESMO gateway que os produtos.
 *
 * ── A lacuna que estes testes fecham ──────────────────────────────────────
 *
 * A rota de cobrança importava o Mercado Pago fixado na importação, e a tela
 * de assinar renderizava o checkout dele direto. Nada quebrava, e era esse o
 * problema: com `GATEWAY=wiven`, todo produto ia para a Wiven e **toda
 * assinatura continuava indo para o Mercado Pago**.
 *
 * Não é só inconsistência. O split 40/40/20 vive na cobrança da Wiven — então
 * a receita de assinatura caía inteira numa conta só, sem repasse a ninguém,
 * e sem nenhum sinal de que algo estivesse fora do lugar.
 */
describe('a cobrança de assinatura', () => {
  const rota = codigoDe('src/app/api/cobranca/[id]/pagamento/route.ts');

  test('passa pelo roteador de gateway, não pelo Mercado Pago fixo', () => {
    assert.match(rota, /provedorPara\(meio\)/);
    assert.doesNotMatch(
      rota,
      /^\s*pagamento,$/m,
      'importar `pagamento` do mercadopago prende a assinatura a um gateway'
    );
  });

  /**
   * Cair para outro gateway no meio de uma cobrança de CARTÃO pode cobrar
   * duas vezes: quando a chamada estoura, não dá para saber se a primeira
   * nasceu do outro lado. No Pix não há esse risco.
   */
  test('a queda para o Mercado Pago é só no Pix', () => {
    assert.match(rota, /meio === 'pix'/);
    assert.match(rota, /nomeDoGateway !== 'mercadopago'/);
    assert.match(rota, /ErroDeGatewayIndisponivel/);
  });

  /** O valor sai do banco. Valor que passa pelo navegador é valor editável. */
  test('o valor continua vindo da cobrança, não do corpo', () => {
    assert.match(rota, /precoCentavos: cobranca!\.valor_centavos/);
  });

  /** Plano não leva cupom: o preço dele é o da tabela `planos`. */
  test('a cobrança de plano segue sem desconto', () => {
    assert.match(rota, /descontoPercentual: 0/);
  });
});

describe('a tela de assinar', () => {
  const tela = codigoDe('src/app/assinar/[id]/page.tsx');

  test('usa o checkout multi-gateway', () => {
    assert.match(tela, /<Checkout/);
    assert.doesNotMatch(tela, /<CheckoutMercadoPago/);
    assert.match(tela, /base="cobranca"/);
  });

  /**
   * Sondar antes de pintar evita abrir um checkout apontado para um gateway
   * que não está respondendo — a pessoa só descobriria ao apertar pagar.
   */
  test('resolve o gateway sondando antes de renderizar', () => {
    assert.match(tela, /gatewayConferido\('pix'\)/);
    assert.match(tela, /gatewayConferido\('cartao'\)/);
  });

  /**
   * A Wiven exige pagador identificado e a `cobranca` só guarda e-mail. Quem
   * vê oferta de assinatura já comprou antes: o último pedido tem nome e CPF.
   */
  test('pré-preenche o pagador a partir do último pedido', () => {
    assert.match(tela, /pagadorDaConta\(cobranca\.email\)/);
  });
});
