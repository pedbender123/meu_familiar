/**
 * "Dá para reiniciar o site agora?"
 *
 *   npx tsx scripts/tem-gente-online.ts
 *
 * Sai com código 0 quando está livre e 1 quando NÃO está — então dá para
 * encadear num deploy:
 *
 *   npx tsx scripts/tem-gente-online.ts && npm run build && pm2 restart bruxario
 *
 * ── O que conta como "tem gente" ──────────────────────────────────────────
 *
 * Duas coisas diferentes, e a segunda é a que realmente machuca:
 *
 * 1. **Visitantes ativos** nos últimos minutos. Reiniciar derruba a navegação
 *    deles — chato, recuperável com um F5.
 * 2. **Pedidos em voo**: qualquer pedido em `pago` ou `gerando`. Esse é o caso
 *    grave. A geração roda em memória, então matar o processo no meio deixa o
 *    pedido preso em `gerando` para sempre, com o dinheiro já cobrado. Existe
 *    o reprocessador para consertar, mas ninguém quer descobrir isso pelo
 *    e-mail de um cliente.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { online, ondeEstaoAgora } from '../src/lib/analitica';

const MINUTOS = Number(process.argv[2] ?? 5);

const pessoas = online(MINUTOS);
const emVoo = db
  .prepare(
    `SELECT id, status, criado_em FROM pedidos
      WHERE status IN ('pago','gerando') AND exemplo = 0
      ORDER BY criado_em DESC`
  )
  .all() as { id: string; status: string; criado_em: string }[];

console.log(`\nÚltimos ${MINUTOS} min:`);
console.log(`  visitantes ativos ....... ${pessoas}`);
console.log(`  pedidos em processamento  ${emVoo.length}`);

if (pessoas > 0) {
  for (const o of ondeEstaoAgora(MINUTOS)) {
    console.log(`    ${o.n}× ${o.caminho}`);
  }
}

for (const p of emVoo) {
  console.log(`    ${p.status.padEnd(8)} ${p.id}  (desde ${p.criado_em})`);
}

if (emVoo.length > 0) {
  console.log('\n⛔ NÃO reinicie: há pedido em processamento.');
  console.log('   Matar o processo agora deixa o pedido preso, com o dinheiro cobrado.\n');
  process.exit(1);
}

if (pessoas > 0) {
  console.log('\n⚠️  Tem gente navegando. Reiniciar derruba a sessão delas.\n');
  process.exit(1);
}

console.log('\n✅ Livre. Pode atualizar.\n');
process.exit(0);
