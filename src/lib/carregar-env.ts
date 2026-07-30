import fs from 'fs';
import { ENV } from './caminhos';

/**
 * Carrega o `.env` para scripts standalone.
 *
 * O `next dev`/`next start` faz isso sozinho via `@next/env`; um `tsx
 * script.ts` não. Esta função replica o comportamento do Next nos pontos que
 * importam para este projeto — e cada um deles já causou um bug real:
 *
 * 1. **Aspas ao redor do valor são removidas.** `EMAIL_REMETENTE="Bruxário
 *    <familiar@bruxario.com.br>"` precisa das aspas no arquivo (o valor tem
 *    espaços), mas o valor em si não as inclui. Sem remover, o Resend recusou
 *    o envio com `Invalid from field` — e como isso só afeta os scripts, o app
 *    funcionava e o script não.
 * 2. **`\$` vira `$` literal.** Herança das chaves do Asaas, que começavam com
 *    `$`; sem o escape o Next trataria como início de variável a expandir.
 * 3. **`#` só inicia comentário fora de aspas.** Um valor entre aspas pode
 *    conter `#` — cortar ali truncaria a senha ou o token no meio.
 */
export function carregarEnv() {
  if (!fs.existsSync(ENV)) return;

  for (const linha of fs.readFileSync(ENV, 'utf8').split('\n')) {
    const texto = linha.trim();
    if (!texto || texto.startsWith('#') || !texto.includes('=')) continue;

    const separador = texto.indexOf('=');
    const chave = texto.slice(0, separador).trim();
    const valor = interpretarValor(texto.slice(separador + 1));

    // Variável já definida no ambiente ganha do arquivo — é como o Next se
    // comporta, e é o que permite sobrescrever numa chamada pontual.
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

function interpretarValor(bruto: string): string {
  const texto = bruto.trim();

  // Entre aspas: o conteúdo é literal até a aspa de fechamento, inclusive `#`.
  const aspa = texto[0];
  if (aspa === '"' || aspa === "'") {
    const fim = texto.indexOf(aspa, 1);
    if (fim > 0) return texto.slice(1, fim);
  }

  // Sem aspas: `#` inicia comentário, e `\$` é um `$` literal.
  const semComentario = texto.split('#')[0].trim();
  return semComentario.startsWith('\\$')
    ? `$${semComentario.slice(2)}`
    : semComentario;
}
