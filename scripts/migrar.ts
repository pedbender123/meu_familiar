/**
 * Roda as migrações pendentes e mostra o histórico.
 *
 *   npm run migrar
 *
 * Na prática já roda sozinho no boot (`db.ts` chama `executarMigracoes` na
 * importação) — este script existe para rodar manualmente antes de um
 * deploy, ou para inspecionar o histórico sem subir o site.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { historicoDeMigracoes } from '../src/lib/migracoes/runner';

// A importação de '../src/lib/db' já rodou executarMigracoes(db) na carga do
// módulo — o que falta aqui é só mostrar o resultado.
const historico = historicoDeMigracoes(db);

console.log(`${historico.length} migração(ões) aplicada(s):\n`);
for (const { id, aplicada_em } of historico) {
  console.log(`  ${id}  —  ${aplicada_em}`);
}
