import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';

import { dentroDaJanela, TOLERANCIA_SEGUNDOS } from '@/app/api/webhook/route';

/**
 * Guarda contra a regressão mais cara que este projeto já quase teve.
 *
 * O `toleranceSeconds` do SDK `mercadopago` v3.2.1 lê o `ts` do cabeçalho como
 * milissegundos, mas o Mercado Pago manda em segundos. Usá-lo faria **toda**
 * notificação legítima ser recusada com 401 — pedido pago, nada entregue, e
 * nenhuma pista no log de que a causa é uma unidade de tempo.
 *
 * Descoberto em 30/07/2026 testando com o segredo real, antes de qualquer
 * venda. Estes testes existem para que ninguém "simplifique" isso de volta
 * para o `toleranceSeconds` do SDK.
 */
const SEGREDO = 'segredo-de-teste-nao-e-o-de-producao';
const DATA_ID = '1234567890';
const REQUEST_ID = 'req-abc-123';

function assinar(ts: string, segredo = SEGREDO) {
  const manifesto = `id:${DATA_ID};request-id:${REQUEST_ID};ts:${ts};`;
  const hash = createHmac('sha256', segredo).update(manifesto).digest('hex');
  return `ts=${ts},v1=${hash}`;
}

describe('janela de replay do webhook', () => {
  const agora = 1_800_000_000_000; // ms
  const emSegundos = String(Math.floor(agora / 1000));
  const emMilissegundos = String(agora);

  test('aceita o timestamp EM SEGUNDOS, que é o que o MP manda', () => {
    assert.equal(dentroDaJanela(`ts=${emSegundos},v1=abc`, agora), true);
  });

  test('aceita também em milissegundos, caso o MP mude', () => {
    assert.equal(dentroDaJanela(`ts=${emMilissegundos},v1=abc`, agora), true);
  });

  test('recusa um replay antigo', () => {
    const velho = String(Math.floor(agora / 1000) - TOLERANCIA_SEGUNDOS - 60);
    assert.equal(dentroDaJanela(`ts=${velho},v1=abc`, agora), false);
  });

  test('recusa timestamp do futuro além da tolerância', () => {
    const futuro = String(Math.floor(agora / 1000) + TOLERANCIA_SEGUNDOS + 60);
    assert.equal(dentroDaJanela(`ts=${futuro},v1=abc`, agora), false);
  });

  test('aceita na borda exata da tolerância', () => {
    const borda = String(Math.floor(agora / 1000) - TOLERANCIA_SEGUNDOS);
    assert.equal(dentroDaJanela(`ts=${borda},v1=abc`, agora), true);
  });

  test('recusa cabeçalho ausente, vazio ou sem ts', () => {
    assert.equal(dentroDaJanela(null, agora), false);
    assert.equal(dentroDaJanela('', agora), false);
    assert.equal(dentroDaJanela('v1=abc', agora), false);
    assert.equal(dentroDaJanela('ts=,v1=abc', agora), false);
    assert.equal(dentroDaJanela('ts=abc,v1=def', agora), false);
  });
});

describe('HMAC do SDK (o que ele faz bem)', () => {
  const ts = String(Math.floor(Date.now() / 1000));

  function validar(opcoes: {
    xSignature?: string | null;
    xRequestId?: string;
    dataId?: string;
    secret?: string;
  }) {
    try {
      WebhookSignatureValidator.validate({
        // `in` e não `??`: passar null de propósito precisa continuar null,
        // senão o teste de cabeçalho ausente testa uma assinatura válida.
        xSignature: 'xSignature' in opcoes ? opcoes.xSignature : assinar(ts),
        xRequestId: opcoes.xRequestId ?? REQUEST_ID,
        dataId: opcoes.dataId ?? DATA_ID,
        secret: opcoes.secret ?? SEGREDO,
        // sem toleranceSeconds — é justamente o que está quebrado
      });
      return 'aceitou';
    } catch (erro) {
      return erro instanceof InvalidWebhookSignatureError ? erro.reason : 'outro';
    }
  }

  test('aceita a assinatura correta', () => {
    assert.equal(validar({}), 'aceitou');
  });

  test('recusa segredo errado', () => {
    assert.equal(validar({ secret: 'outro' }), 'SignatureMismatch');
  });

  test('recusa data.id adulterado', () => {
    assert.equal(validar({ dataId: '9999' }), 'SignatureMismatch');
  });

  test('recusa request-id adulterado', () => {
    assert.equal(validar({ xRequestId: 'outro' }), 'SignatureMismatch');
  });

  test('recusa cabeçalho ausente', () => {
    assert.equal(validar({ xSignature: null }), 'MissingSignatureHeader');
  });
});

describe('a armadilha do SDK, documentada em teste', () => {
  test('toleranceSeconds RECUSA um timestamp legítimo em segundos', () => {
    // Se este teste um dia falhar, o SDK foi corrigido — e aí dá para voltar
    // a usar toleranceSeconds e apagar `dentroDaJanela`.
    const ts = String(Math.floor(Date.now() / 1000));
    let motivo = 'aceitou';
    try {
      WebhookSignatureValidator.validate({
        xSignature: assinar(ts),
        xRequestId: REQUEST_ID,
        dataId: DATA_ID,
        secret: SEGREDO,
        toleranceSeconds: TOLERANCIA_SEGUNDOS,
      });
    } catch (erro) {
      motivo = erro instanceof InvalidWebhookSignatureError ? erro.reason : 'outro';
    }
    assert.equal(
      motivo,
      'TimestampOutOfTolerance',
      'o SDK parece ter sido corrigido — reavalie se `dentroDaJanela` ainda é necessária'
    );
  });
});
