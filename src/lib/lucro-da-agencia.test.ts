import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * A conta da venda real de 27/08, em centavos.
 *
 *   preço            1890
 *   taxa da Wiven     313
 *   split João        630
 *   split plataforma  315
 *   sobra p/ Murilo   632
 *
 * O que a agência (Murilo + João) leva: 632 + 630 = 1262.
 */
const PRECO = 1890;
const TAXA = 313;
const SPLIT_DA_PLATAFORMA = 315;

describe('o que a Utmify recebe é o lucro da agência', () => {
  const retirado = TAXA + SPLIT_DA_PLATAFORMA;
  const lucro = PRECO - retirado;

  test('a conta fecha nos números da venda real', () => {
    assert.equal(retirado, 628);
    assert.equal(lucro, 1262, 'Murilo (632) + João (630)');
  });

  /**
   * O bug de 27/08: a taxa era deduzida por subtração do que a Wiven devolve
   * como `commissionAmount`, e engolia os splits. A taxa apareceu como 1257 —
   * 66% de uma venda de dezoito reais — e o lucro reportado virou 633.
   *
   * O número final é parecido por coincidência, e é por isso que passou
   * despercebido: 633 era a fatia do Murilo sozinho, sem a do João.
   */
  test('não é o que o bug produzia por acidente', () => {
    const bug = PRECO - 1257;
    assert.equal(bug, 633);
    assert.notEqual(bug, lucro, 'o bug escondia a fatia do sócio');
  });

  test('a fatia da plataforma sai do lucro deles', () => {
    const fonte = codigoDe('src/lib/reportar-venda.ts');
    assert.match(fonte, /pedido\.split_do_dono_centavos \?\? 0/);
    assert.match(fonte, /retiradoCentavos/);
  });

  /**
   * ── Mudou em 01/09/2026: vai o valor CHEIO ──────────────────────────────
   *
   * Até aqui a dedução ia junto, e a comissão saía descontada. A intenção era
   * boa — quem lê o painel decide escalar ou pausar, e ver o bruto faz o CPA
   * parecer melhor do que é.
   *
   * Mudou porque o repasse mudou. Com os splits desligados, a receita inteira
   * cai numa conta só e a divisão passou a ser feita entre as pessoas, fora
   * do sistema. Uma dedução parcial dava um número que não era o bruto nem o
   * líquido de ninguém.
   *
   * O que a agência lê passa a ser sobre o BRUTO. Quem comparar com o extrato
   * acha a diferença da taxa, e é isso mesmo.
   */
  test('a Utmify recebe o valor cheio, sem dedução', () => {
    const fonte = codigoDe('src/lib/utmify.ts');
    assert.match(fonte, /gatewayFeeInCents: 0/);
    assert.match(fonte, /userCommissionInCents: pedido\.produto\.precoCentavos/);
  });

  /**
   * E o caminho de volta continua alimentado: `reportar-venda.ts` ainda
   * calcula `retiradoCentavos` e o entrega. Voltar a descontar é trocar dois
   * valores em `utmify.ts`, sem mexer em mais nada — e o dia em que os splits
   * voltarem, é isso que vai ser preciso.
   */
  test('o cálculo da dedução continua disponível para voltar', () => {
    const fonte = codigoDe('src/lib/reportar-venda.ts');
    assert.match(fonte, /retiradoCentavos/);
    assert.match(fonte, /pedido\.split_do_dono_centavos \?\? 0/);
  });

  /**
   * Sem plataforma configurada, nada muda: o lucro reportado volta a ser tudo
   * que sobrou da taxa. É o certo para quem não divide com plataforma nenhuma.
   */
  test('sem fatia de plataforma, o comportamento antigo volta', () => {
    const w = codigoDe('src/nucleo/checkouts/wiven.ts');
    assert.match(w, /WIVEN_PRODUCER_DO_DONO/);
    assert.match(w, /dono\s*\?[\s\S]*?: 0/);
  });
});

describe('o painel interno continua vendo a taxa de verdade', () => {
  /**
   * São dois consumidores com necessidades opostas. A agência precisa saber
   * o lucro dela; o dono da plataforma precisa saber quanto o gateway cobra
   * de verdade — misturar os dois faria a Wiven parecer cobrar 66%.
   */
  test('o webhook devolve a taxa real ao pedido', () => {
    const fonte = codigoDe('src/app/api/webhook/wiven/route.ts');
    assert.match(fonte, /resultado\.taxaCentavos - splitCentavos/);
  });

  test('o repasse é gravado separado do total', () => {
    const rota = codigoDe('src/app/api/pedido/[id]/pagamento/route.ts');
    assert.match(rota, /split_centavos: resultado\.splitCentavos/);
    assert.match(rota, /split_do_dono_centavos: resultado\.splitDoDonoCentavos/);
  });
});
