import test from 'node:test';
import assert from 'node:assert/strict';
import { decidir, balde, type Interruptor } from './interruptores';

function interruptor(sobrescreve: Partial<Interruptor> = {}): Interruptor {
  return {
    chave: 'teste',
    ligado: 1,
    percentual: 0,
    contas_incluidas: null,
    nota: null,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    ...sobrescreve,
  };
}

test('interruptor inexistente é sempre desligado — nunca libera por acidente', () => {
  assert.equal(decidir(undefined, 'conta-1'), false);
  assert.equal(decidir(undefined), false);
});

test('ligado=0 vence tudo, mesmo com percentual 100', () => {
  assert.equal(decidir(interruptor({ ligado: 0, percentual: 100 }), 'conta-1'), false);
});

test('percentual 0 nunca libera, mesmo ligado', () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(decidir(interruptor({ percentual: 0 }), `conta-${i}`), false);
  }
});

test('percentual 100 sempre libera para quem tem identidade', () => {
  for (let i = 0; i < 50; i++) {
    assert.equal(decidir(interruptor({ percentual: 100 }), `conta-${i}`), true);
  }
});

test('0 e 100 não precisam de identidade — só o meio-termo precisa de balde', () => {
  assert.equal(decidir(interruptor({ percentual: 100 })), true);
  assert.equal(decidir(interruptor({ percentual: 0 })), false);
});

test('sem identidade, um percentual intermediário nunca libera (não há como colocar em balde)', () => {
  assert.equal(decidir(interruptor({ percentual: 50 })), false);
});

test('conta na lista explícita passa mesmo com percentual 0', () => {
  const i = interruptor({
    percentual: 0,
    contas_incluidas: JSON.stringify(['pedro@bruxario.com.br']),
  });
  assert.equal(decidir(i, 'pedro@bruxario.com.br'), true);
  assert.equal(decidir(i, 'outra-conta'), false);
});

test('lista de contas com JSON corrompido não derruba a checagem — só é ignorada', () => {
  const i = interruptor({ percentual: 0, contas_incluidas: '{ isto não é json' });
  assert.equal(decidir(i, 'qualquer-conta'), false);
});

test('balde é determinístico: mesma chave+identidade sempre cai no mesmo lugar', () => {
  const primeiro = balde('novo-checkout', 'conta-42');
  for (let i = 0; i < 10; i++) {
    assert.equal(balde('novo-checkout', 'conta-42'), primeiro);
  }
});

test('balde está sempre entre 0 e 99', () => {
  for (let i = 0; i < 200; i++) {
    const b = balde('chave', `identidade-${i}`);
    assert.ok(b >= 0 && b <= 99, `balde fora da faixa: ${b}`);
  }
});

test('chaves diferentes não colam a mesma pessoa no mesmo lado de dois rollouts', () => {
  // Não é uma garantia matemática, é uma checagem de sanidade: se isto falhar
  // sempre, a função de hash está com bug óbvio (ex: ignorando a chave).
  const identidade = 'conta-mesma-pessoa';
  const resultados = new Set<number>();
  for (const chave of ['exp-a', 'exp-b', 'exp-c', 'exp-d', 'exp-e']) {
    resultados.add(balde(chave, identidade));
  }
  assert.ok(resultados.size > 1, 'todas as chaves caíram no mesmo balde — hash suspeito');
});

test('rollout percentual: a fração observada bate aproximadamente com o percentual pedido', () => {
  const i = interruptor({ percentual: 30 });
  let ligados = 0;
  const total = 2000;
  for (let n = 0; n < total; n++) {
    if (decidir(i, `visitante-${n}`)) ligados++;
  }
  const fracao = ligados / total;
  // Faixa larga de propósito — isto testa "a amostra é razoável", não
  // "o gerador de hash é perfeitamente uniforme".
  assert.ok(fracao > 0.24 && fracao < 0.36, `fração observada: ${fracao}`);
});
