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

test('todo plano tem acesso pra sempre hoje (duracao_dias null) — Fase 6 muda isso, não a Fase 2', () => {
  for (const plano of listarPlanos()) {
    assert.equal(plano.duracao_dias, null);
  }
});
