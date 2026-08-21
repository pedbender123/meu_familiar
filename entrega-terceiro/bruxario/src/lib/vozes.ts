import type { Familiar } from './familiares';

/**
 * Concordância de gênero do familiar.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────
 *
 * Sete dos doze familiares são femininos — A Coruja, A Raposa, A Lebre, A
 * Mariposa, A Aranha, A Gata Preta, A Serpente. A interface dizia "Ele está
 * esperando" para todo mundo, então mais da metade das pessoas lia o texto
 * errado sobre a própria familiar, bem no momento de decidir a compra. Erro
 * de concordância nesse ponto não é detalhe de português: quebra a ilusão de
 * que o sistema sabe alguma coisa sobre ela.
 *
 * O dado já existia em `familiares.ts` (campo `genero`) — faltava usar.
 */
export interface Voz {
  /** "ele" / "ela" */
  ele: string;
  /** "Ele" / "Ela" */
  Ele: string;
  /** "o" / "a" — artigo definido */
  o: string;
  /** "dele" / "dela" */
  dele: string;
  /** Concorda um particípio: escolhid(o|a) */
  concorda: (masculino: string, feminino: string) => string;
}

export function vozDe(familiar: Familiar | null | undefined): Voz {
  const f = familiar?.genero === 'f';
  return {
    ele: f ? 'ela' : 'ele',
    Ele: f ? 'Ela' : 'Ele',
    o: f ? 'a' : 'o',
    dele: f ? 'dela' : 'dele',
    concorda: (masculino, feminino) => (f ? feminino : masculino),
  };
}
