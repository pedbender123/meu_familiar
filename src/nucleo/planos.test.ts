import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarPlano, listarPlanos, direitosDoPlano } from './planos';
import { PRODUTOS } from '../lib/produtos';

/**
 * `005_nucleo_assinaturas.ts` semeia `planos` como espelho de `PRODUTOS` — a
 * escrita dupla da Fase 2 só é segura se os dois nunca divergirem em preço.
 * Este teste é a trava: se algum dia produtos.ts mudar de preço sem
 * atualizar o seed, ele quebra aqui, alto e claro, em vez de silenciosamente
 * fazer a assinatura cobrar (ou "achar" que cobrou) um valor errado.
 */

test('a migração semeou revelacao e completa', () => {
  const planos = listarPlanos();
  const ids = planos.map((p) => p.id);
  assert.ok(ids.includes('revelacao'));
  assert.ok(ids.includes('completa'));
});

test('preço do plano bate com o preço do produto correspondente', () => {
  for (const id of ['revelacao', 'completa'] as const) {
    const plano = buscarPlano(id);
    assert.ok(plano, `plano ${id} deveria existir`);
    assert.equal(plano!.preco_centavos, PRODUTOS[id].precoCentavos);
  }
});

test('direitos do plano batem com as flags do produto correspondente', () => {
  for (const id of ['revelacao', 'completa'] as const) {
    const plano = buscarPlano(id)!;
    const direitos = direitosDoPlano(plano);
    const produto = PRODUTOS[id];
    assert.equal(direitos.pdf, produto.pdf);
    assert.equal(direitos.imagens, produto.imagens);
    assert.equal(direitos.relatorioCompleto, produto.relatorioCompleto);
    assert.equal(direitos.graficos, produto.graficos);
    assert.equal(direitos.perfilPublico, produto.perfilPublico);
    assert.equal(direitos.tiragemDiaria, produto.tiragemDiaria);
    assert.equal(direitos.perguntasOraculo, produto.perguntasOraculo);
    assert.equal(direitos.narracaoAudio, produto.narracaoAudio);
  }
});

test('plano nunca semeado devolve undefined, não lança', () => {
  assert.equal(buscarPlano('nao-existe'), undefined);
});

/**
 * Este teste dizia "todo plano tem acesso pra sempre (`duracao_dias` null) —
 * Fase 6 muda isso". A Fase 6 chegou: existem planos de assinatura com prazo.
 * O que ele passa a travar é a fronteira entre os dois modelos, que é o que
 * de fato não pode quebrar sem alguém decidir.
 */
test('avulso antigo é pra sempre; assinatura tem prazo — e ninguém perde o que pagou', () => {
  for (const plano of listarPlanos()) {
    if (plano.recorrente) {
      assert.ok(
        plano.duracao_dias && plano.duracao_dias > 0,
        `${plano.id} é recorrente, então precisa de prazo`
      );
    } else {
      assert.equal(
        plano.duracao_dias,
        null,
        `${plano.id} não é recorrente — dar prazo a ele tiraria acesso de quem já comprou`
      );
    }
  }
});

test('os avulsos saíram da vitrine mas continuam válidos', () => {
  for (const id of ['revelacao', 'completa']) {
    const plano = buscarPlano(id);
    assert.ok(plano, `${id} não pode ser apagado — há assinatura apontando pra ele`);
    assert.equal(plano!.publico, 0, `${id} não deve mais aparecer na vitrine`);
    assert.equal(plano!.ativo, 1, `${id} tem que continuar ativo pra quem já tem`);
  }
});

test('quem tem cota mensal tem cota diária — senão a cota mensal é inalcançável', () => {
  for (const plano of listarPlanos()) {
    const direitos = direitosDoPlano(plano);
    if (direitos.perguntasOraculo > 0) {
      assert.ok(
        direitos.perguntasOraculoPorDia > 0,
        `${plano.id} dá ${direitos.perguntasOraculo} perguntas no mês e 0 no dia — ninguém consegue usar`
      );
    }
  }
});
