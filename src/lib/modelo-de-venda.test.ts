import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { precoDoPedido } from './cupons';
import db from './db';
import { definirInterruptor } from './interruptores';
import {
  CHAVE_DO_MODELO_NOVO,
  modeloNovoLigado,
  precoVigenteCentavos,
  produtoVigente,
  destinoDepoisDaEntrega,
} from './modelo-de-venda';

/**
 * O desvio provisório existe para produção receber 57 commits sem trocar o
 * negócio no meio de uma campanha que está no ar vendendo a R$ 9,80.
 *
 * O que estes testes protegem é a única coisa que não pode falhar: **com o
 * interruptor desligado, o site cobra o que sempre cobrou.**
 */

function ligar(v: boolean) {
  definirInterruptor({ chave: CHAVE_DO_MODELO_NOVO, ligado: v, percentual: 100 });
}

beforeEach(() => {
  db.exec('DELETE FROM interruptores');
});

describe('desligado — o modelo de produção', () => {
  test('sem registro nenhum no banco já está desligado', () => {
    assert.equal(modeloNovoLigado(), false, 'caminho novo nasce desligado');
  });

  /** O erro que custaria dinheiro: entregar de graça o que o anúncio cobra. */
  test('a Revelação custa o preço da campanha, não zero', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 980);
    assert.equal(produtoVigente('revelacao').precoCentavos, 980);
  });

  test('depois da entrega vai para a revelação, como produção faz hoje', () => {
    assert.equal(destinoDepoisDaEntrega('abc'), '/revelacao/abc');
  });

  /**
   * A porta sem landing já está em produção desde 19/08 e é o que a campanha
   * em curso usa para converter. Se ela passasse pelo interruptor, subir com
   * a chave desligada devolveria a landing para quem hoje cai direto na
   * pergunta — desfazendo justamente o que fez o funil funcionar.
   */
  test('o interruptor não toca na porta sem landing', () => {
    const raiz = readFileSync('src/app/page.tsx', 'utf8');
    assert.ok(
      !raiz.includes('modeloNovoLigado'),
      'a raiz não pode consultar o interruptor para decidir landing'
    );
  });

  test('produtos que não mudaram de preço seguem iguais', () => {
    assert.equal(precoVigenteCentavos('completa'), 1890);
  });
});

describe('ligado — o modelo novo', () => {
  beforeEach(() => ligar(true));

  test('a Revelação é grátis', () => {
    assert.equal(precoVigenteCentavos('revelacao'), 0);
  });

  test('depois da entrega vai para a oferta de três degraus', () => {
    assert.equal(destinoDepoisDaEntrega('abc'), '/oferta/abc');
  });
});

describe('virar a chave', () => {
  test('desligar volta ao preço antigo na hora, sem deploy', () => {
    ligar(true);
    assert.equal(precoVigenteCentavos('revelacao'), 0);
    ligar(false);
    assert.equal(precoVigenteCentavos('revelacao'), 980);
  });
});

describe('nenhuma rota decide preço pela tabela estática', () => {
  /**
   * O bug de 21/08, travado.
   *
   * `/api/quiz` lia `produtoDe()` — a tabela estática, onde a Revelação está
   * zerada porque o modelo novo a tornou grátis. Com o interruptor DESLIGADO,
   * `preco.gratis` ficava verdadeiro assim mesmo e a rota entregava o produto
   * sem passar pelo gateway.
   *
   * Duas pessoas receberam de graça o que a campanha estava vendendo antes de
   * alguém perceber. O que denuncia é `pago_em` igual a `criado_em`: o pedido
   * nasceu pago.
   *
   * Este teste lê o código das rotas que decidem cobrança e recusa qualquer
   * uma que chame `produtoDe` para calcular preço. Um teste de comportamento
   * não pegaria: cada rota nova reintroduz o furo do seu próprio jeito.
   */
  const ROTAS_QUE_COBRAM = [
    'src/app/api/quiz/route.ts',
    'src/app/api/pedido/[id]/escolher/route.ts',
    'src/app/api/cupom/route.ts',
  ];

  for (const rota of ROTAS_QUE_COBRAM) {
    test(`${rota} usa o preço vigente, não a tabela`, () => {
      const fonte = readFileSync(rota, 'utf8');

      assert.ok(
        fonte.includes('produtoVigente') || fonte.includes('precoVigenteCentavos'),
        'a rota precisa consultar o modelo vigente para saber o preço'
      );

      /**
       * `produtoDe` ainda pode aparecer para VALIDAR o id do produto — o que
       * não pode é o resultado dele alimentar um cálculo de preço.
       */
      const alimentaPreco = /precoComDesconto\(\s*produtoDe\(/.test(fonte);
      assert.equal(
        alimentaPreco,
        false,
        'preço calculado a partir de `produtoDe` ignora o interruptor'
      );
    });
  }

  test('com o interruptor desligado, a Revelação nunca é grátis', () => {
    ligar(false);
    const preco = precoVigenteCentavos('revelacao');
    assert.ok(preco > 0, 'preço zero faz o funil entregar sem cobrar');
    assert.equal(preco, 980);
  });
});

describe('nenhum caminho de cobrança escapa do interruptor', () => {
  /**
   * O teste que faltava, e a falta dele custou duas vendas em 21/08.
   *
   * `produtos.ts` tem a Revelação zerada — ela virou a porta de entrada do
   * modelo novo. Com o interruptor desligado ela precisa custar o preço da
   * campanha, e QUALQUER rota que leia a tabela direto vai achar zero, cair
   * no caminho de "grátis" e entregar sem cobrar.
   *
   * Foi o que aconteceu: `escolher` e `/seu-familiar` usavam o preço vigente,
   * mas `/api/quiz` chamava `produtoDe` — e é ele que decide se a venda passa
   * pelo gateway.
   */
  test('as rotas que decidem preço não leem a tabela estática', () => {
    const suspeitas = [
      'src/app/api/quiz/route.ts',
      'src/app/api/pedido/[id]/escolher/route.ts',
    ];

    for (const caminho of suspeitas) {
      const fonte = readFileSync(caminho, 'utf8');
      assert.ok(
        !/produtoDe\(\s*\n?\s*ehProdutoValido|precoComDesconto\(\s*produtoDe\(/.test(fonte),
        `${caminho} calcula preço com produtoDe — tem que usar produtoVigente`
      );
    }
  });

  /**
   * `precoDoPedido` é o que a tela mostra e o que o painel soma. Se ele ler a
   * tabela direto, a vitrine mostra R$ 0,00 num pedido que o gateway vai
   * cobrar — ou pior, o inverso.
   */
  test('precoDoPedido segue o interruptor', () => {
    ligar(false);
    assert.equal(
      precoDoPedido({ produto: 'revelacao', desconto_percentual: null }).finalCentavos,
      980
    );
    ligar(true);
    assert.equal(
      precoDoPedido({ produto: 'revelacao', desconto_percentual: null }).finalCentavos,
      0
    );
  });

  /** Com o interruptor desligado, a Revelação nunca cai no caminho gratuito. */
  test('desligado, a Revelação não é grátis em lugar nenhum', () => {
    ligar(false);
    assert.equal(
      precoDoPedido({ produto: 'revelacao', desconto_percentual: null }).gratis,
      false
    );
  });
});
