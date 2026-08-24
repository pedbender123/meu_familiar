/**
 * Cobrança de teste de R$ 1,00 contra a API REAL da Cakto.
 *
 *   npm run cakto-fumaca
 *
 * A Cakto não tem sandbox: não existe lugar onde errar de graça. Este script
 * faz o caminho inteiro de saída — token, oferta, cobrança — e imprime o link
 * de pagamento e o copia-e-cola do Pix.
 *
 * Pix não pago expira sozinho em uma hora, então rodar isto não custa nada.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { randomUUID } from 'crypto';
import { garantirOferta, obterToken, montarCorpo } from '../src/nucleo/checkouts/cakto';

const PRECO_CENTAVOS = 500;
const BASE = 'https://api.cakto.com.br/public_api';

async function principal() {
  const pedidoId = `teste-${randomUUID().slice(0, 8)}`;
  console.log(`\n  Cakto — cobrança de teste de R$ 5,00 (mínimo da Cakto)\n`);

  const offerId = await garantirOferta(
    { id: 'teste', descricao: 'Teste', precoCentavos: PRECO_CENTAVOS },
    PRECO_CENTAVOS
  );
  console.log(`  oferta: ${offerId}`);

  const corpo = montarCorpo(
    {
      form: { payment_method_id: 'pix' },
      produto: { id: 'teste', descricao: 'Teste', precoCentavos: PRECO_CENTAVOS },
      pedidoId,
      emailDoPedido: 'teste@bruxario.com.br',
      descontoPercentual: 0,
      cakto: {
        metodo: 'pix',
        nome: 'Teste Bruxario',
        telefone: '5511999999999',
        docNumber: '12345678909',
        docType: 'cpf',
        fingerprint: `fp_${randomUUID()}`,
        utm: { utm_source: 'teste' },
      },
    },
    offerId
  );

  const resposta = await fetch(`${BASE}/payments/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await obterToken()}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(corpo),
  });

  const texto = await resposta.text();
  if (!resposta.ok) {
    console.error(`\n  ❌ ${resposta.status}\n\n${texto}\n`);
    process.exit(1);
  }

  const r = JSON.parse(texto);

  console.log(`  id:     ${r.id}`);
  console.log(`  status: ${r.status}`);
  console.log(`  valor:  R$ ${r.amount}`);
  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  LINK DE PAGAMENTO:\n  ${r.checkoutUrl}`);
  console.log(`  ╚══════════════════════════════════════════════════════╝\n`);

  if (r.pix?.qrCode) {
    console.log(`  Pix copia-e-cola:\n\n${r.pix.qrCode}\n`);
  }
}

principal().catch((e) => {
  console.error('\n  falhou:', e.message, '\n');
  process.exit(1);
});
