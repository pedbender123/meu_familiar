/**
 * Uma cópia consistente do banco, para antes de qualquer deploy.
 *
 * ── Por que não é `cp` ────────────────────────────────────────────────────
 *
 * O banco roda em WAL com o app escrevendo nele. O `cp` copia o arquivo
 * principal no meio de uma escrita e deixa o `-wal` para trás — o resultado
 * abre com "database disk image is malformed".
 *
 * Isso não é teórico: em 01/09 um backup feito com `cp` estava corrompido
 * exatamente na hora em que ele era a única forma de desfazer uma alteração
 * errada em produção. O que salvou foi outro backup, por sorte.
 *
 * `.backup()` do SQLite conhece o WAL e sai consistente mesmo com escrita
 * acontecendo. A VPS não tem o CLI `sqlite3`, mas a biblioteca que o app já
 * usa expõe a mesma operação.
 *
 * Uso: node scripts/backup-banco.js <caminho-de-destino>
 */
const destino = process.argv[2];
if (!destino) {
  console.error('uso: node scripts/backup-banco.js <destino>');
  process.exit(2);
}

const db = require('better-sqlite3')('var/data/bruxario.db', { readonly: true });

db.backup(destino)
  .then(() => {
    console.log(`backup consistente: ${destino}`);
    process.exit(0);
  })
  .catch((erro) => {
    // Deploy sem backup não acontece: o build aplica migrações no banco real.
    console.error('BACKUP FALHOU, abortando o deploy:', erro.message);
    process.exit(1);
  });
