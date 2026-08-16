import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  modoAtual,
  chavePublica,
  segredoDoWebhook,
  pagamentoEhFake,
  conferirCoerencia,
} from './mercadopago';

/**
 * A troca entre teste e produção é a lógica onde um erro custa dinheiro nos
 * dois sentidos: cobrar alguém achando que era teste, ou não cobrar achando
 * que era produção. Estes testes fixam o comportamento.
 */
const VARIAVEIS = [
  'MP_MODO',
  'MP_TESTE_ACCESS_TOKEN',
  'MP_TESTE_PUBLIC_KEY',
  'MP_TESTE_WEBHOOK_SECRET',
  'MP_PROD_ACCESS_TOKEN',
  'MP_PROD_PUBLIC_KEY',
  'MP_PROD_WEBHOOK_SECRET',
  'MP_WEBHOOK_SECRET',
];

function limpar() {
  for (const v of VARIAVEIS) delete process.env[v];
}

beforeEach(limpar);

describe('modo de pagamento', () => {
  test('sem nada configurado, cai em fake — nunca cobra por acidente', () => {
    assert.equal(modoAtual(), 'fake');
    assert.equal(pagamentoEhFake(), true);
  });

  test('o padrão é TESTE, não produção', () => {
    // Esquecer de definir MP_MODO não pode resultar em cobrança real.
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    process.env.MP_PROD_ACCESS_TOKEN = 'APP_USR-xyz';
    assert.equal(modoAtual(), 'teste');
  });

  test('MP_MODO=producao escolhe o par de produção', () => {
    process.env.MP_MODO = 'producao';
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    process.env.MP_TESTE_PUBLIC_KEY = 'TEST-pub';
    process.env.MP_PROD_ACCESS_TOKEN = 'APP_USR-xyz';
    process.env.MP_PROD_PUBLIC_KEY = 'APP_USR-pub';

    assert.equal(modoAtual(), 'producao');
    assert.equal(chavePublica(), 'APP_USR-pub');
  });

  test('MP_MODO aceita espaço e maiúscula', () => {
    process.env.MP_MODO = '  PRODUCAO ';
    process.env.MP_PROD_ACCESS_TOKEN = 'APP_USR-xyz';
    assert.equal(modoAtual(), 'producao');
  });

  test('valor desconhecido em MP_MODO cai em teste, não em produção', () => {
    process.env.MP_MODO = 'prod'; // quase certo, e por isso perigoso
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    process.env.MP_PROD_ACCESS_TOKEN = 'APP_USR-xyz';
    assert.equal(modoAtual(), 'teste');
  });

  test('modo declarado sem credencial vira fake, não estoura', () => {
    process.env.MP_MODO = 'producao';
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    // MP_PROD_ACCESS_TOKEN ausente
    assert.equal(modoAtual(), 'fake');
  });

  test('string vazia conta como ausente', () => {
    process.env.MP_MODO = 'teste';
    process.env.MP_TESTE_ACCESS_TOKEN = '';
    assert.equal(modoAtual(), 'fake');
  });
});

describe('segredo do webhook', () => {
  test('usa o segredo geral quando não há um específico do modo', () => {
    process.env.MP_MODO = 'teste';
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    process.env.MP_WEBHOOK_SECRET = 'geral';
    assert.equal(segredoDoWebhook(), 'geral');
  });

  test('o específico do modo ganha do geral', () => {
    process.env.MP_MODO = 'teste';
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    process.env.MP_TESTE_WEBHOOK_SECRET = 'do-teste';
    process.env.MP_WEBHOOK_SECRET = 'geral';
    assert.equal(segredoDoWebhook(), 'do-teste');
  });

  test('cada modo pega o seu', () => {
    process.env.MP_TESTE_WEBHOOK_SECRET = 'do-teste';
    process.env.MP_PROD_WEBHOOK_SECRET = 'da-producao';

    process.env.MP_MODO = 'teste';
    assert.equal(segredoDoWebhook(), 'do-teste');

    process.env.MP_MODO = 'producao';
    assert.equal(segredoDoWebhook(), 'da-producao');
  });
});

describe('coerência entre modo e credencial', () => {
  test('nada a dizer quando o par bate', () => {
    process.env.MP_MODO = 'producao';
    process.env.MP_PROD_ACCESS_TOKEN = 'APP_USR-xyz';
    assert.equal(conferirCoerencia(), null);

    limpar();
    process.env.MP_MODO = 'teste';
    process.env.MP_TESTE_ACCESS_TOKEN = 'TEST-abc';
    assert.equal(conferirCoerencia(), null);
  });

  test('avisa quando modo=teste tem token de PRODUÇÃO — o caso que cobra sem querer', () => {
    process.env.MP_MODO = 'teste';
    process.env.MP_TESTE_ACCESS_TOKEN = 'APP_USR-xyz';
    const alerta = conferirCoerencia();
    assert.ok(alerta, 'deveria avisar');
    assert.match(alerta!, /COBRA DE VERDADE/);
  });

  test('avisa quando modo=producao tem token de teste — o caso que não cobra', () => {
    process.env.MP_MODO = 'producao';
    process.env.MP_PROD_ACCESS_TOKEN = 'TEST-abc';
    const alerta = conferirCoerencia();
    assert.ok(alerta, 'deveria avisar');
    assert.match(alerta!, /nada será cobrado/i);
  });

  test('sem credencial, não há incoerência a apontar', () => {
    process.env.MP_MODO = 'producao';
    assert.equal(conferirCoerencia(), null);
  });
});
