/**
 * Backup de todos os bancos SQLite do projeto, com verificação de integridade
 * e limpeza do que passou da retenção.
 *
 *   npm run backup
 *
 * Roda antes de toda migração (ver Fase 0 de docs/reestruturacao.md) e pode
 * entrar num cron diário. Sai com código 1 se qualquer backup sair inválido —
 * um backup corrompido silencioso é pior que não ter backup, porque só é
 * descoberto na hora em que se precisa dele.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import fs from 'fs';
import path from 'path';
import { BANCO, DADOS } from '../src/lib/caminhos';
import { criarBackup, verificarBackup, backupsAntigos } from '../src/lib/backup';

const RETENCAO_DIAS = 14;

async function main() {
  const alvos = [BANCO, path.join(DADOS, 'horoscopo.db')].filter(fs.existsSync);

  if (alvos.length === 0) {
    console.log('Nenhum banco encontrado em', DADOS);
    return;
  }

  let falhou = false;

  for (const alvo of alvos) {
    const resultado = await criarBackup(alvo);
    if (!verificarBackup(resultado.destino)) {
      console.error(`✗ ${path.basename(alvo)} — backup saiu inválido: ${resultado.destino}`);
      falhou = true;
      continue;
    }
    const kb = (resultado.tamanhoBytes / 1024).toFixed(0);
    console.log(`✓ ${path.basename(alvo)} → ${path.basename(resultado.destino)} (${kb} KB)`);
  }

  const antigos = backupsAntigos(undefined, RETENCAO_DIAS);
  for (const antigo of antigos) {
    fs.rmSync(antigo);
    console.log(`  limpo (> ${RETENCAO_DIAS}d): ${path.basename(antigo)}`);
  }

  if (falhou) process.exitCode = 1;
}

main();
