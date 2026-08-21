import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { BACKUPS } from './caminhos';

export interface ResultadoBackup {
  origem: string;
  destino: string;
  tamanhoBytes: number;
}

/**
 * Backup online de um banco SQLite — seguro com `journal_mode=WAL`.
 *
 * Usa a API de backup nativa do SQLite (`db.backup()`, do better-sqlite3) em
 * vez de copiar o arquivo `.db` direto. Com WAL, a escrita mais recente vive
 * no `-wal` até o checkpoint — uma cópia de arquivo simples pega o `.db`
 * desatualizado e perde exatamente os dados mais recentes, que são os que
 * mais importam preservar.
 *
 * Abre a origem em `readonly` — o backup nunca precisa, e nunca deve, escrever
 * no banco de produção.
 */
export async function criarBackup(
  caminhoOrigem: string,
  pastaDestino = BACKUPS
): Promise<ResultadoBackup> {
  if (!fs.existsSync(caminhoOrigem)) {
    throw new Error(`Banco não encontrado: ${caminhoOrigem}`);
  }
  fs.mkdirSync(pastaDestino, { recursive: true });

  const nome = path.basename(caminhoOrigem, '.db');
  const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
  const destino = path.join(pastaDestino, `${nome}-${carimbo}.db`);

  const origemDb = new Database(caminhoOrigem, { readonly: true, fileMustExist: true });
  try {
    await origemDb.backup(destino);
  } finally {
    origemDb.close();
  }

  /**
   * `journal_mode` fica gravado na página 1 do próprio arquivo — a cópia
   * herda WAL da origem mesmo sem nenhum processo ter aberto o destino em
   * modo de escrita ainda. Isso faz até uma leitura `readonly` recriar um
   * `-shm` do nada. Convertendo para `DELETE` aqui, o backup vira um arquivo
   * único de verdade: nada de satélite para esquecer de copiar junto quando
   * alguém mover o backup de lugar.
   */
  const destinoDb = new Database(destino);
  destinoDb.pragma('journal_mode = DELETE');
  destinoDb.close();
  for (const sufixo of ['-wal', '-shm']) {
    const lateral = `${destino}${sufixo}`;
    if (fs.existsSync(lateral)) fs.rmSync(lateral);
  }

  return { origem: caminhoOrigem, destino, tamanhoBytes: fs.statSync(destino).size };
}

/**
 * Prova que um arquivo é um SQLite íntegro e legível — não só que existe.
 *
 * Um backup "automático" em que ninguém nunca tentou ler de volta é fé, não
 * garantia. Isto roda depois de todo backup (ver `scripts/backup.ts`) e de
 * novo antes de toda restauração — nunca confia em backup não verificado.
 */
export function verificarBackup(caminho: string): boolean {
  if (!fs.existsSync(caminho)) return false;
  try {
    const db = new Database(caminho, { readonly: true, fileMustExist: true });
    try {
      const [linha] = db.pragma('integrity_check') as { integrity_check: string }[];
      return linha?.integrity_check === 'ok';
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

/**
 * Restaura um backup por cima do banco de destino.
 *
 * O destino atual, se existir, é preservado como `.pre-restauracao` — uma
 * restauração feita sem querer não pode virar mais uma forma de perder dados.
 * O `-wal`/`-shm` do destino são removidos: eles pertencem ao banco antigo, e
 * deixá-los ali misturaria escrita velha com o arquivo restaurado.
 */
export function restaurarBackup(caminhoBackup: string, caminhoDestino: string): void {
  if (!verificarBackup(caminhoBackup)) {
    throw new Error(`Backup corrompido ou inválido, restauração recusada: ${caminhoBackup}`);
  }
  if (fs.existsSync(caminhoDestino)) {
    fs.copyFileSync(caminhoDestino, `${caminhoDestino}.pre-restauracao`);
  }
  fs.copyFileSync(caminhoBackup, caminhoDestino);
  for (const sufixo of ['-wal', '-shm']) {
    const lateral = `${caminhoDestino}${sufixo}`;
    if (fs.existsSync(lateral)) fs.rmSync(lateral);
  }
}

/** Caminhos de backup mais antigos que `dias` — para o script decidir o que limpar. */
export function backupsAntigos(pasta = BACKUPS, dias = 14): string[] {
  if (!fs.existsSync(pasta)) return [];
  const limite = Date.now() - dias * 86_400_000;
  return fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith('.db'))
    .map((f) => path.join(pasta, f))
    .filter((caminho) => fs.statSync(caminho).mtimeMs < limite);
}
