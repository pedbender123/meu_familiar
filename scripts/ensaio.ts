/**
 * Cria um ambiente de ensaio: cópia isolada e íntegra dos bancos reais, para
 * testar migração arriscada sem chegar perto de produção (Fase 0 de
 * docs/reestruturacao.md).
 *
 *   npm run ensaio
 *
 * Depois, aponte qualquer script ou o próprio `next dev` para a cópia:
 *
 *   BRUXARIO_DIR_DADOS="var/ensaio/<carimbo>/data" npm run migrar
 *   BRUXARIO_DIR_DADOS="var/ensaio/<carimbo>/data" npm run dev
 *
 * Nada aqui abre o banco real em modo de escrita — `criarBackup` usa a API de
 * backup do SQLite em `readonly`, o mesmo mecanismo de `npm run backup`.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import fs from 'fs';
import path from 'path';
import { DADOS } from '../src/lib/caminhos';
import { criarBackup, verificarBackup } from '../src/lib/backup';

async function main() {
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const pastaEnsaio = path.join(process.cwd(), 'var', 'ensaio', carimbo);
  const dadosEnsaio = path.join(pastaEnsaio, 'data');
  fs.mkdirSync(dadosEnsaio, { recursive: true });

  const origens = ['bruxario.db', 'horoscopo.db']
    .map((arquivo) => ({ arquivo, caminho: path.join(DADOS, arquivo) }))
    .filter((o) => fs.existsSync(o.caminho));

  if (origens.length === 0) {
    console.log('Nenhum banco encontrado em', DADOS, '— nada para copiar.');
    fs.rmSync(pastaEnsaio, { recursive: true, force: true });
    return;
  }

  for (const { arquivo, caminho } of origens) {
    const resultado = await criarBackup(caminho, dadosEnsaio);
    if (!verificarBackup(resultado.destino)) {
      throw new Error(`Cópia de ${arquivo} para o ensaio saiu inválida — abortando.`);
    }
    // criarBackup carimba o nome (bruxario-2026-...db); o ensaio precisa do
    // nome fixo que caminhos.ts espera dentro de qualquer DIR_DADOS.
    fs.renameSync(resultado.destino, path.join(dadosEnsaio, arquivo));
    console.log(`✓ ${arquivo} copiado`);
  }

  console.log(`\nAmbiente de ensaio pronto em:\n  ${pastaEnsaio}\n`);
  console.log('Para usar:');
  console.log(`  BRUXARIO_DIR_DADOS="${dadosEnsaio}" npm run migrar`);
  console.log(`  BRUXARIO_DIR_DADOS="${dadosEnsaio}" npm run dev\n`);
  console.log('É uma cópia isolada — nada disto toca o banco real.');
}

main();
