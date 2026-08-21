/**
 * Drena a fila do Conversions API — quem de fato fala com a Meta.
 *
 *   npm run capi
 *
 * Pensado para cron a cada poucos minutos. Idempotente: só mexe no que está
 * `pendente` e na hora (backoff exponencial entre tentativas).
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { processarFilaCapi, resumoDaFilaCapi } from '../src/lib/fila-capi';

async function main() {
  const { enviados, falharam, adiados } = await processarFilaCapi();
  console.log(`enviados=${enviados} falharam=${falharam} adiados=${adiados}`);

  const resumo = resumoDaFilaCapi();
  console.log(`fila: ${resumo.pendentes} pendente(s), ${resumo.falharamDefinitivo} desistido(s)`);

  if (resumo.falharamDefinitivo > 0) {
    console.log('\nPara o que desistiu, ver a Sentinela (npm run sentinela) ou rodar');
    console.log('scripts/backfill-pixel.ts manualmente para esses pedidos específicos.');
  }
}

main();
