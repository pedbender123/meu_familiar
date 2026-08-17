import test from 'node:test';
import assert from 'node:assert/strict';
import { PISO_COBRAVEL_CENTAVOS, normalizarCodigo, precoComDesconto } from './cupons';
import { PRODUTOS, type Produto } from './produtos';

/**
 * Um produto de preço FIXO só para estes testes.
 *
 * Usar `DE_980` acoplava a matemática do desconto ao preço
 * comercial — quando a Revelação virou grátis (agosto/2026), meia dúzia de
 * testes de arredondamento quebrou sem que nada de arredondamento tivesse
 * mudado. O que se testa aqui é a CONTA, não a tabela de preços.
 */
const DE_980: Produto = { ...PRODUTOS.completa, precoCentavos: 980 };

/**
 * Estes testes protegem a única coisa aqui que é irreversível: o valor
 * cobrado. Errar o desenho da tela custa um deploy; errar o arredondamento
 * custa dinheiro de alguém, e um estorno manual por pessoa.
 */

test('normalizar aceita as variações que a pessoa realmente digita', () => {
  for (const bruto of ['amiga10', ' AMIGA10 ', 'amiga-10', 'Amiga 10', 'amigá10']) {
    assert.equal(normalizarCodigo(bruto), 'AMIGA10', `falhou em "${bruto}"`);
  }
});

test('normalizar não deixa passar código vazio disfarçado', () => {
  for (const lixo of ['', '   ', '---', '!!!']) {
    assert.equal(normalizarCodigo(lixo), '');
  }
});

test('20% da Revelação arredonda a favor de quem compra', () => {
  // 980 × 0,8 = 784 exato. Um caso sem ambiguidade, para ancorar.
  const p = precoComDesconto(DE_980, 20);
  assert.equal(p.finalCentavos, 784);
  assert.equal(p.gratis, false);
});

test('o arredondamento nunca cobra mais que o preço exato', () => {
  // A regra é Math.ceil, então o valor cobrado pode ser até 1 centavo ACIMA do
  // exato — o que este teste fixa é que nunca passa disso, em nenhum dos três
  // produtos, para nenhum percentual.
  for (const produto of Object.values(PRODUTOS)) {
    for (let pct = 0; pct <= 100; pct++) {
      const exato = produto.precoCentavos * (1 - pct / 100);
      const { finalCentavos, gratis } = precoComDesconto(produto, pct);
      if (gratis) continue;
      assert.ok(
        finalCentavos - exato < 1,
        `${produto.id} a ${pct}%: cobrou ${finalCentavos}, exato ${exato}`
      );
      assert.ok(finalCentavos >= exato, `${produto.id} a ${pct}%: cobrou menos que o exato`);
    }
  }
});

test('100% é grátis em todos os produtos', () => {
  for (const produto of Object.values(PRODUTOS)) {
    const p = precoComDesconto(produto, 100);
    assert.equal(p.finalCentavos, 0);
    assert.equal(p.gratis, true, `${produto.id} a 100% deveria ser grátis`);
  }
});

test('valor abaixo do piso vira grátis em vez de cobrança recusada', () => {
  // O gateway recusa centavos soltos. Se este comportamento sumir, a pessoa vê
  // uma tela de erro no lugar do produto — que é pior que dar de graça.
  const p = precoComDesconto(DE_980, 95); // 980 → 49
  assert.ok(49 < PISO_COBRAVEL_CENTAVOS);
  assert.equal(p.gratis, true);
  assert.equal(p.finalCentavos, 0);
});

test('nunca existe cobrança entre zero e o piso', () => {
  for (const produto of Object.values(PRODUTOS)) {
    for (let pct = 0; pct <= 100; pct++) {
      const { finalCentavos } = precoComDesconto(produto, pct);
      assert.ok(
        finalCentavos === 0 || finalCentavos >= PISO_COBRAVEL_CENTAVOS,
        `${produto.id} a ${pct}% gerou ${finalCentavos}, que o gateway recusaria`
      );
    }
  }
});

test('percentual fora da faixa é contido, não explode nem inverte o preço', () => {
  // Um valor negativo vindo de dado corrompido não pode virar acréscimo, e um
  // acima de 100 não pode virar preço negativo.
  assert.equal(precoComDesconto(DE_980, -50).finalCentavos, 980);
  assert.equal(precoComDesconto(DE_980, 999).finalCentavos, 0);
  assert.equal(precoComDesconto(DE_980, 0).finalCentavos, 980);
});

test('sem cupom, o preço é exatamente o de tabela', () => {
  for (const produto of Object.values(PRODUTOS)) {
    assert.equal(precoComDesconto(produto).finalCentavos, produto.precoCentavos);
    // `gratis` acompanha o preço, e desde que a Revelação virou grátis
    // (agosto/2026) há produto de tabela com preço zero — ele TEM que sair
    // marcado como grátis, senão iria parar no gateway, que recusa R$ 0,00.
    assert.equal(
      precoComDesconto(produto).gratis,
      produto.precoCentavos < PISO_COBRAVEL_CENTAVOS
    );
  }
});
