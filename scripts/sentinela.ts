/**
 * Roda a varredura da Sentinela e mostra o que está aberto.
 *
 *   npm run sentinela
 *
 * Pensado para rodar em cron (a cada hora, por exemplo) — ver a disciplina
 * de alarmes em docs/reestruturacao.md, Fase 1.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { varrerPedidos } from '../src/nucleo/sentinela/varredura';
import { anomaliasAbertas, contagemPorInvariante } from '../src/nucleo/sentinela/registrar';

const { verificados } = varrerPedidos();
console.log(`${verificados} pedido(s) verificado(s).\n`);

const contagem = contagemPorInvariante();
if (contagem.length === 0) {
  console.log('Nenhuma anomalia aberta.');
} else {
  console.log('Anomalias abertas, por invariante:');
  for (const { invariante, severidade, n } of contagem) {
    console.log(`  [${severidade}] ${invariante}: ${n}`);
  }

  const criticas = anomaliasAbertas('critico');
  if (criticas.length > 0) {
    console.log('\nCríticas:');
    for (const a of criticas) {
      console.log(`  #${a.id} ${a.entidadeTipo}:${a.entidadeId}`);
      console.log(`    esperado:  ${a.esperado}`);
      console.log(`    encontrado: ${a.encontrado}`);
    }
    process.exitCode = 1;
  }
}
