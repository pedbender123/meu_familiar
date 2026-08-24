/**
 * Cobrança de teste contra a API REAL da Wiven.
 *
 *   npm run wiven-fumaca
 *
 * Não achei sandbox na documentação deles — então este script faz o caminho
 * inteiro de saída (credenciais, Pix, consulta) com o menor valor que der, e
 * imprime o copia-e-cola. Pix não pago expira sozinho; rodar isto não custa.
 *
 * O que ele NÃO faz: cartão. Testar cartão de verdade exige um cartão de
 * verdade, e este script não é lugar para isso.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { randomUUID } from 'crypto';
import {
  ProvedorWiven,
  wivenConfigurada,
  tokenDoWebhook,
  urlDeCallback,
  identificadorDe,
  emReais,
} from '../src/nucleo/checkouts/wiven';

const PRECO_CENTAVOS = 500;
const BASE = 'https://app.wiven.com.br/api/v1';

function cabecalhos() {
  return {
    'Content-Type': 'application/json',
    'x-public-key': process.env.WIVEN_PUBLIC_KEY!.trim(),
    'x-secret-key': process.env.WIVEN_SECRET_KEY!.trim(),
  };
}

async function principal() {
  console.log('\n  Wiven — fumaça\n');

  if (!wivenConfigurada()) {
    console.error('  ✗ falta WIVEN_PUBLIC_KEY / WIVEN_SECRET_KEY no .env');
    process.exit(1);
  }
  console.log('  ✓ chaves presentes');

  if (!tokenDoWebhook()) {
    console.warn(
      '  ⚠ WIVEN_WEBHOOK_TOKEN vazio — o gateway.ts recusa a Wiven assim,\n' +
        '    de propósito: cobraria sem nunca entregar.'
    );
  } else {
    console.log('  ✓ token de webhook presente');
  }
  console.log(`  · callback: ${urlDeCallback()}`);

  // 1. as credenciais valem?
  const cred = await fetch(`${BASE}/gateway/producer/credentials`, { headers: cabecalhos() });
  console.log(`\n  credenciais → ${cred.status} ${cred.ok ? '✓' : '✗'}`);
  if (!cred.ok) {
    console.error(`  ${await cred.text()}`);
    process.exit(1);
  }

  // 2. um Pix de verdade
  const pedidoId = `teste-${randomUUID().slice(0, 8)}`;
  const identifier = identificadorDe(pedidoId);

  const resposta = await fetch(`${BASE}/gateway/pix/receive`, {
    method: 'POST',
    headers: cabecalhos(),
    body: JSON.stringify({
      identifier,
      amount: emReais(PRECO_CENTAVOS),
      client: {
        name: 'Teste do Bruxário',
        email: 'teste@bruxario.com.br',
        phone: '(11) 99999-9999',
        document: process.env.WIVEN_CPF_TESTE ?? '123.456.789-00',
      },
      metadata: { provider: 'Bruxario', orderId: pedidoId },
      callbackUrl: urlDeCallback(),
    }),
  });

  const corpo = await resposta.text();
  console.log(`\n  Pix de R$ ${emReais(PRECO_CENTAVOS)} → ${resposta.status}`);
  if (!resposta.ok) {
    console.error(`  ✗ ${corpo}`);
    process.exit(1);
  }

  const dados = JSON.parse(corpo);
  console.log(`  ✓ transactionId: ${dados.transactionId}`);
  console.log(`  · status na criação: ${dados.status}  (traduzimos para "pending")`);
  console.log(`  · identifier enviado: ${identifier}`);
  console.log(`\n  copia-e-cola:\n  ${dados.pix?.code}\n`);
  if (dados.pix?.image) console.log(`  QR: ${dados.pix.image}\n`);

  // 3. a consulta acha, e devolve o nosso identificador?
  const wiven = new ProvedorWiven();
  const consulta = await wiven.consultarPagamento(dados.transactionId);
  console.log('  consulta →', consulta ? '✓' : '✗');
  if (consulta) {
    console.log(`  · status: ${consulta.status}`);
    console.log(`  · referenciaExterna: ${consulta.referenciaExterna}`);
    if (consulta.referenciaExterna !== pedidoId) {
      console.error(
        `\n  ✗ ATENÇÃO: esperava reencontrar "${pedidoId}" e veio ` +
          `"${consulta.referenciaExterna}". O webhook não vai achar o pedido.`
      );
      process.exit(1);
    }
    console.log('  ✓ o pedido é reencontrado pelo identificador');
  }

  console.log('\n  Pronto. Pague o Pix acima para ver o webhook chegar.\n');
}

principal().catch((erro) => {
  console.error('\n  ✗', erro);
  process.exit(1);
});
