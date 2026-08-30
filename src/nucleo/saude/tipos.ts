/**
 * O vocabulário da tela de saúde.
 *
 * Um tipo só para todo sinal, e é ele que faz a tela ser útil em vez de
 * decorativa. Ver `docs/PLANO-PAINEL-DE-SAUDE.md` §4.2.
 */

/**
 * ── Por que `desconhecido` existe ─────────────────────────────────────────
 *
 * Sem venda no período, "0 vendas reportadas" não é falha — é falta de dado.
 * Pintar isso de vermelho ensina a ignorar vermelho, e alarme ignorado é pior
 * que alarme nenhum. Separar os dois é a diferença entre um painel que se
 * olha e um que se fecha.
 */
export type Estado = 'ok' | 'atencao' | 'quebrado' | 'desconhecido';

export interface Sinal {
  /** Curto, em português, legível por quem não escreveu o código. */
  nome: string;
  estado: Estado;
  /** O número ou texto medido. Vazio quando não há o que mostrar. */
  valor?: string;
  /**
   * A frase que resolve.
   *
   * **Não é opcional em sinal ruim.** Um alarme que diz "webhook parado" e
   * não diz "confira WIVEN_WEBHOOK_TOKEN no .env" é um alarme que vai acordar
   * alguém às 3h da manhã para uma coisa que o dono resolveria sozinho.
   * `sinaisDoSistema` garante isso; `saude.test.ts` prova.
   */
  oQueFazer?: string;
}

export interface GrupoDeSinais {
  titulo: string;
  /** Por que este grupo existe, para quem abre a tela sem contexto. */
  nota: string;
  sinais: Sinal[];
}

/** Quantos sinais estão ruins. É o número que vira carimbo na Central. */
export function quantosRuins(grupos: GrupoDeSinais[]): number {
  return grupos.reduce(
    (total, g) => total + g.sinais.filter((s) => s.estado === 'quebrado' || s.estado === 'atencao').length,
    0
  );
}

/** O pior estado do conjunto. Ordena a urgência sem inventar pontuação. */
export function piorEstado(grupos: GrupoDeSinais[]): Estado {
  const todos = grupos.flatMap((g) => g.sinais.map((s) => s.estado));
  if (todos.includes('quebrado')) return 'quebrado';
  if (todos.includes('atencao')) return 'atencao';
  if (todos.every((e) => e === 'desconhecido')) return 'desconhecido';
  return 'ok';
}
