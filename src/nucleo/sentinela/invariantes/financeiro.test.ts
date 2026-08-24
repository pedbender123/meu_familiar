import test from 'node:test';
import assert from 'node:assert/strict';
import { checarValorCobrado, checarEntregaTemPagamento } from './financeiro';
import type { Pedido } from '../../../lib/db';

function pedido(sobrescreve: Partial<Pedido> = {}): Pedido {
  return {
    id: 'p1',
    nome: 'Helena',
    email: 'helena@exemplo.com',
    cpf: null,
    respostas_json: '{}',
    familiar: 'coruja',
    lua: 'cheia',
    signo_sol: null,
    signo_lua: null,
    produto: 'completa',
    utm_json: null,
    gateway: null,
    telefone: null,
    ip_comprador: null,
    perfil_json: null,
    desempatado_pela_pessoa: 0,
    expira_em: null,
    acesso_gratis_em: null,
    melhoria_pagamento_id: null,
    melhoria_paga_em: null,
    melhoria_bruto_centavos: null,
    pago_em: null,
    lembrete_em: null,
    exemplo: 0,
    origem: null,
    variante: null,
    bonus_oraculo: 0,
    mensagem_familiar: null,
    audio_bilhete: 0,
    audio_narracao: 0,
    bruto_centavos: null,
    taxa_centavos: null,
    liquido_centavos: null,
    metodo_pagamento: null,
    metodo_tentado: null,
    motivo_recusa: null,
    tentativas_pagamento: 0,
    grupo: null,
    ritual_completo: 0,
    cenas_respondidas: 0,
    resgate_em: null,
    mensagens_ritual: null,
    custo_ia_centavos: 0,
    visitante: null,
    cupom: null,
    campanha_id: null,
    peca_id: null,
    atribuicao: null,
    indicado_por: null,
    funil: null,
    pixel_capi_em: null,
    desconto_percentual: null,
    cupom_contabilizado: 0,
    status: 'aguardando_pagamento',
    pagamento_id: null,
    pix_copia_e_cola: null,
    leitura_json: null,
    tentativas: 0,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescreve,
  };
}

test('checarValorCobrado: pedido nunca pago não é checado (bruto null é normal aqui)', () => {
  assert.equal(checarValorCobrado(pedido({ pago_em: null, bruto_centavos: null })), null);
});

test('checarValorCobrado: valor batendo com o preço de tabela, sem cupom, passa', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa',
    bruto_centavos: 1890, // preço de tabela da Completa
  });
  assert.equal(checarValorCobrado(p), null);
});

test('checarValorCobrado: valor batendo com desconto de cupom aplicado, passa', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa',
    cupom: 'AMIGA20',
    desconto_percentual: 20,
    bruto_centavos: 1512, // 1890 * 0.8
  });
  assert.equal(checarValorCobrado(p), null);
});

test('checarValorCobrado: PEGA o caso que originou a regra — pago sem valor e sem cupom de 100%', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa',
    cupom: null,
    desconto_percentual: null,
    bruto_centavos: null, // nada foi cobrado, e não há cupom que justifique
  });
  const anomalia = checarValorCobrado(p);
  assert.ok(anomalia, 'deveria detectar a anomalia');
  assert.equal(anomalia!.severidade, 'critico');
  assert.equal(anomalia!.invariante, 'valor_cobrado_bate_com_produto_e_cupom');
});

test('checarValorCobrado: pega valor cobrado MENOR que o devido (desconto maior que o do cupom)', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa', // 1890 centavos
    cupom: 'AMIGA20',
    desconto_percentual: 20, // deveria dar 1512
    bruto_centavos: 100, // cobrou quase nada — preço adulterado no caminho
  });
  const anomalia = checarValorCobrado(p);
  assert.ok(anomalia);
  assert.match(anomalia!.esperado, /1512/);
  assert.match(anomalia!.encontrado, /100/);
});

test('checarValorCobrado: cupom de 100% dispensa o gateway — bruto null é o ESPERADO, não anomalia', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa',
    cupom: 'GRATIS100',
    desconto_percentual: 100,
    bruto_centavos: null,
  });
  assert.equal(checarValorCobrado(p), null);
});

test('checarValorCobrado: pedido "grátis" que MESMO ASSIM foi cobrado é anomalia', () => {
  const p = pedido({
    pago_em: '2026-01-01T00:00:00.000Z',
    status: 'pago',
    produto: 'completa',
    cupom: 'GRATIS100',
    desconto_percentual: 100,
    bruto_centavos: 1890, // cobrou o preço cheio de um pedido que devia ser grátis
  });
  const anomalia = checarValorCobrado(p);
  assert.ok(anomalia, 'cobrar de um pedido marcado como 100% de desconto é anomalia');
});

test('checarEntregaTemPagamento: pedido entregue sem pago_em é a invariante de acesso sem origem', () => {
  const p = pedido({ status: 'entregue', pago_em: null });
  const anomalia = checarEntregaTemPagamento(p);
  assert.ok(anomalia);
  assert.equal(anomalia!.invariante, 'entrega_sem_pagamento');
  assert.equal(anomalia!.severidade, 'critico');
});

test('checarEntregaTemPagamento: amostra do mural (exemplo=1) nunca é anomalia, mesmo sem pagamento', () => {
  const p = pedido({ status: 'entregue', pago_em: null, exemplo: 1 });
  assert.equal(checarEntregaTemPagamento(p), null);
});

test('checarEntregaTemPagamento: entregue e pago passa limpo', () => {
  const p = pedido({ status: 'entregue', pago_em: '2026-01-01T00:00:00.000Z' });
  assert.equal(checarEntregaTemPagamento(p), null);
});

test('checarEntregaTemPagamento: pedido só "pago" (ainda não entregue) não é checado por esta regra', () => {
  const p = pedido({ status: 'pago', pago_em: '2026-01-01T00:00:00.000Z' });
  assert.equal(checarEntregaTemPagamento(p), null);
});
