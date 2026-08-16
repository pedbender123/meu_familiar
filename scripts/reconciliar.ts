/**
 * Compara o Mercado Pago com o banco local e reprocessa webhook perdido.
 *
 *   npm run reconciliar                  # últimas 48h
 *   npm run reconciliar -- --horas=6     # janela menor, pra cron frequente
 *
 * Precisa de credencial real configurada (`MP_MODO` + `MP_*_ACCESS_TOKEN`)
 * — sem isso, `pagamento.listarPagosNoPeriodo` volta lista vazia e não há o
 * que reconciliar (comportamento seguro, não é erro).
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { reconciliarPeriodo } from '../src/nucleo/reconciliacao';
import { modoAtual } from '../src/lib/pagamento';

const argHoras = process.argv.find((a) => a.startsWith('--horas='))?.split('=')[1];
const horas = argHoras ? Number(argHoras) : 48;

async function main() {
  const modo = modoAtual();
  if (modo === 'fake') {
    console.log('Modo de pagamento é "fake" (sem credencial configurada) — nada para reconciliar.');
    return;
  }

  const ate = new Date();
  const desde = new Date(ate.getTime() - horas * 3_600_000);
  console.log(`Reconciliando ${desde.toISOString()} → ${ate.toISOString()} (modo: ${modo})`);

  const resultado = await reconciliarPeriodo(desde, ate);
  console.log(`\n${resultado.verificados} pagamento(s) aprovado(s) no período.`);

  if (resultado.webhooksPerdidos > 0) {
    console.log(`⚠️  ${resultado.webhooksPerdidos} webhook(s) perdido(s), reprocessado(s) agora.`);
  }
  if (resultado.semPedidoLocal > 0) {
    console.log(`🔴 ${resultado.semPedidoLocal} pagamento(s) sem NENHUM pedido correspondente — ver npm run sentinela.`);
  }
  if (resultado.webhooksPerdidos === 0 && resultado.semPedidoLocal === 0) {
    console.log('Tudo bate.');
  } else {
    process.exitCode = 1;
  }
}

main();
