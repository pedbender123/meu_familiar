import crypto from 'crypto';
import db from './db';

export interface Interruptor {
  chave: string;
  ligado: number;
  percentual: number;
  contas_incluidas: string | null;
  nota: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function buscarInterruptor(chave: string): Interruptor | undefined {
  return db.prepare('SELECT * FROM interruptores WHERE chave = ?').get(chave) as
    | Interruptor
    | undefined;
}

export function listarInterruptores(): Interruptor[] {
  return db.prepare('SELECT * FROM interruptores ORDER BY chave').all() as Interruptor[];
}

/**
 * Cria ou edita um interruptor. `ON CONFLICT` para o painel poder chamar isto
 * tanto pra criar quanto pra editar sem checar antes se já existe.
 */
export function definirInterruptor(i: {
  chave: string;
  ligado: boolean;
  percentual?: number;
  contasIncluidas?: string[];
  nota?: string | null;
}): void {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO interruptores
       (chave, ligado, percentual, contas_incluidas, nota, criado_em, atualizado_em)
     VALUES (@chave, @ligado, @percentual, @contas_incluidas, @nota, @agora, @agora)
     ON CONFLICT(chave) DO UPDATE SET
       ligado = excluded.ligado,
       percentual = excluded.percentual,
       contas_incluidas = excluded.contas_incluidas,
       nota = excluded.nota,
       atualizado_em = excluded.atualizado_em`
  ).run({
    chave: i.chave,
    ligado: i.ligado ? 1 : 0,
    percentual: i.percentual ?? 0,
    contas_incluidas: i.contasIncluidas ? JSON.stringify(i.contasIncluidas) : null,
    nota: i.nota ?? null,
    agora,
  });
}

/** O botão de pânico da disciplina 8: desliga na hora, sem esperar deploy. */
export function desligarInterruptor(chave: string): void {
  db.prepare('UPDATE interruptores SET ligado = 0, atualizado_em = ? WHERE chave = ?').run(
    new Date().toISOString(),
    chave
  );
}

/**
 * Balde 0-99 determinístico a partir de chave+identidade.
 *
 * Determinístico de propósito: um rollout de "20%" precisa que a MESMA
 * pessoa caia sempre do mesmo lado — sorteio novo a cada chamada faria o
 * comportamento piscar entre ligado e desligado dentro da mesma sessão dela.
 */
export function balde(chave: string, identidade: string): number {
  const hash = crypto.createHash('sha256').update(`${chave}:${identidade}`).digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * A decisão em si, pura — recebe o registro já lido do banco (ou `undefined`
 * se não existe) e a identidade de quem está perguntando, devolve sim/não.
 *
 * Separada de `interruptorLigado()` para ser testável sem tocar no SQLite —
 * mesmo padrão de `cupons.ts` (`precoComDesconto` puro, banco só na borda).
 */
export function decidir(interruptor: Interruptor | undefined, identidade?: string): boolean {
  if (!interruptor || !interruptor.ligado) return false;

  if (identidade && interruptor.contas_incluidas) {
    try {
      const incluidas: string[] = JSON.parse(interruptor.contas_incluidas);
      if (incluidas.includes(identidade)) return true;
    } catch {
      // JSON inválido no banco não derruba a checagem — só ignora a lista
    }
  }

  if (interruptor.percentual >= 100) return true;
  if (interruptor.percentual <= 0) return false;
  if (!identidade) return false; // sem identidade estável não dá pra colocar em balde

  return balde(interruptor.chave, identidade) < interruptor.percentual;
}

/**
 * A pergunta que todo caminho novo faz antes de rodar (disciplina 3).
 *
 * Sem registro no banco = desligado: um interruptor inexistente nunca libera
 * comportamento novo por acidente. `identidade` é o id de conta, ou o cookie
 * de visitante quando ainda não há conta — o que faltar vira "sempre
 * desligado para rollout percentual", só a lista explícita de contas ainda
 * funciona sem identidade estável.
 */
export function interruptorLigado(chave: string, identidade?: string): boolean {
  return decidir(buscarInterruptor(chave), identidade);
}
