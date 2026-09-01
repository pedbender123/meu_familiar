import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Nenhum checkout pode ter a família de rota fixa no código.
 *
 * ── O bug que isto trava ──────────────────────────────────────────────────
 *
 * Os componentes de checkout nasceram apontando para `/api/pedido/...` porque
 * só existia o funil de produtos. Enquanto foi assim, ninguém notou — o id
 * sempre era mesmo de um pedido.
 *
 * No dia em que a assinatura passou a cobrar pela Wiven, o mesmo componente
 * recebeu o id de uma COBRANÇA e foi bater na rota de pedido. O resultado foi
 * **"pedido não encontrado" na tela de pagar, com o cartão já digitado** — o
 * lugar mais caro do funil para um erro aparecer.
 *
 * `CheckoutMercadoPago` já tinha o `base`; os outros dois nasceram sem, e a
 * divergência entre checkouts é exatamente o que se paga por duplicar.
 */
describe('a rota que cada checkout chama', () => {
  const pasta = 'src/components/checkout';
  const componentes = readdirSync(pasta).filter(
    (n) => n.endsWith('.tsx') && !n.endsWith('.test.tsx')
  );

  test('há checkouts para conferir', () => {
    assert.ok(componentes.length >= 3, `só achei ${componentes.length} componentes`);
  });

  for (const nome of componentes) {
    test(`${nome} não fixa /api/pedido`, () => {
      const fonte = readFileSync(join(pasta, nome), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');

      assert.doesNotMatch(
        fonte,
        /fetch\(`\/api\/pedido\//,
        'use `/api/${base}/...` — senão a assinatura quebra na tela de pagar'
      );
    });
  }

  /** E o Checkout precisa repassar o `base` para todos eles. */
  test('o Checkout repassa o base a cada gateway', () => {
    const fonte = readFileSync(join(pasta, 'Checkout.tsx'), 'utf8');
    const repasses = fonte.match(/base=\{base\}/g) ?? [];
    assert.ok(
      repasses.length >= 3,
      `só ${repasses.length} gateways recebem o base; um esquecido quebra em silêncio`
    );
  });
});
