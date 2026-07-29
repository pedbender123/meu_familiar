import fs from 'fs';
import { ENV } from './caminhos';

/**
 * Scripts standalone (fora do `next dev`/`next start`) não ganham o .env de
 * graça — o Next carrega isso sozinho via @next/env, mas um `tsx script.ts`
 * não. Replica aqui só a parte que usamos do comportamento do Next: `\$` no
 * valor vira `$` literal (as chaves da Asaas começam com `$`, e sem esse
 * escape o Next as trataria como início de uma variável a expandir).
 */
export function carregarEnv() {
  const caminho = ENV;
  if (!fs.existsSync(caminho)) return;

  for (const linha of fs.readFileSync(caminho, 'utf8').split('\n')) {
    const semComentario = linha.trim();
    if (!semComentario || semComentario.startsWith('#') || !semComentario.includes('=')) continue;

    const separador = semComentario.indexOf('=');
    const chave = semComentario.slice(0, separador).trim();
    let valor = semComentario.slice(separador + 1).split('#')[0].trim();
    if (valor.startsWith('\\$')) valor = `$${valor.slice(2)}`;

    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
