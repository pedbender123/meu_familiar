/**
 * Verifica anomalias, pedidos travados e falhas definitivas do CAPI; manda
 * e-mail pro ADMIN_EMAIL se houver algo. Pensado para cron de hora em hora.
 *
 *   npm run alarmes
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { verificarEAvisar } from '../src/nucleo/alarmes';

async function main() {
  const { avisou, estado } = await verificarEAvisar();

  console.log(
    `críticas=${estado.criticas} altas=${estado.altas} ` +
      `travados=${estado.pedidosTravados} capi_desistiu=${estado.capiFalhouDefinitivo}`
  );

  if (!estado.precisaAvisar) {
    console.log('Nada pra avisar.');
    return;
  }

  console.log(avisou ? 'E-mail de alarme enviado.' : 'Havia algo, mas não foi possível avisar (ver aviso acima).');
  process.exitCode = 1;
}

main();
