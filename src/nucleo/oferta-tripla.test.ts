import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { escadaDaOferta } from './oferta';

/**
 * A oferta de três degraus, depois da entrega.
 *
 * ── O que estes testes protegem ───────────────────────────────────────────
 *
 * A tela existia, tinha teste, e **nunca apareceu para ninguém**: o destino
 * pós-entrega dependia do interruptor do modelo de venda, que fica desligado
 * porque ligá-lo zeraria o preço que a campanha cobra. Agora ela tem chave
 * própria.
 *
 * E o risco novo que veio junto: as avulsas entregam exatamente os mesmos
 * direitos que `revelacao` e `completa`. Mostrá-las para quem acabou de
 * pagar é cobrar duas vezes pela mesma coisa, na tela seguinte à compra.
 */

const ids = (itens: { plano: { id: string } }[]) => itens.map((i) => i.plano.id);

describe('a escada é sempre a mesma, para todo mundo', () => {
  /**
   * Sem filtro por quem já comprou o quê: a tela é a vitrine da plataforma,
   * e esconder degrau quebra a escada que faz a decisão ficar fácil.
   */
  test('as duas avulsas e a recorrente, nessa ordem', () => {
    assert.deepEqual(ids(escadaDaOferta()), [
      'avulsa_simples',
      'avulsa_completa',
      'revelacao_mensal',
    ]);
  });
});

describe('a janela das avulsas fecha com o acesso grátis', () => {
  test('depois da chave de graça, só permanência', () => {
    assert.deepEqual(ids(escadaDaOferta({ avulsas: false })), ['revelacao_mensal']);
  });
});

describe('os preços são os da campanha', () => {
  /**
   * As avulsas nasceram a 7,90 e 15,90, preços do modelo em que o ritual é
   * grátis. Com a tela no ar enquanto o funil COBRA, dois preços para o mesmo
   * produto na mesma semana queima quem comprou pelo caro.
   */
  test('avulsa simples a R$ 12,90 e completa a R$ 18,90', () => {
    const porId = Object.fromEntries(
      escadaDaOferta().map((i) => [i.plano.id, i.plano.preco_centavos])
    );
    assert.equal(porId.avulsa_simples, 1290);
    assert.equal(porId.avulsa_completa, 1890);
    assert.equal(porId.revelacao_mensal, 2990);
  });
});

/* ────────────────────────────────────────────────────────────────────────
 * O botão da tela de oferta anuncia o preço do anúncio.
 * ──────────────────────────────────────────────────────────────────────── */

import { readFileSync } from 'node:fs';

describe('o CTA depois do ritual', () => {
  /** Os três degraus estão na tela de compra, não só na pós-entrega. */
  test('a tela de compra tem os três cards', () => {
    const fonte = readFileSync('src/components/Oferta.tsx', 'utf8');
    for (const id of ["id: 'revelacao'", "id: 'completa'", "id: 'revelacao_mensal'"]) {
      assert.ok(fonte.includes(id), `falta o card ${id}`);
    }
  });

  /** O plano abre cobrança, não grava produto no pedido. */
  test('o plano vai para a rota de oferta, não para escolher', () => {
    const fonte = readFileSync('src/components/Oferta.tsx', 'utf8');
    assert.ok(/\/api\/oferta\/\$\{pedidoId\}\/comprar/.test(fonte));
  });

  /**
   * ── Este padrão já foi trocado duas vezes, e as duas por um motivo ──────
   *
   * Era `completa`, e o botão dizia "Continuar com a Completa — R$ 18,90"
   * para quem tinha clicado num anúncio de R$ 9,80. Entre 21 e 23/08: 21
   * pessoas chegaram nesta tela, **2 clicaram**, e os dois cliques foram no
   * padrão. Foi trocado para `revelacao` em 23/08 — casar o botão com o
   * preço anunciado.
   *
   * Em 24/08 o dono trocou de volta para `completa`, decisão de ticket. Fica
   * registrado o que a medição anterior mostrou, para que a próxima leitura
   * do funil saiba o que comparar: se o clique na oferta cair de novo, o
   * suspeito número um é esta linha, não a tela.
   */
  test('a Completa é o plano pré-selecionado', () => {
    const fonte = readFileSync('src/components/Oferta.tsx', 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      ''
    );
    assert.ok(
      /useState<EscolhaId>\('completa'\)/.test(fonte),
      'o padrão da oferta é uma decisão de preço — trocar sem querer muda o ticket'
    );
  });
});
