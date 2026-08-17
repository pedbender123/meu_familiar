/**
 * O contrato dos espetáculos (ver `docs/oraculo.md`).
 *
 * ── O que um espetáculo é ─────────────────────────────────────────────────
 *
 * É a parte **determinística e grátis** do ritual: sorteia ou lê símbolos,
 * devolve eles nomeados, e uma animação mostra o processo. A IA só entra
 * depois, recebendo esses símbolos como matéria-prima.
 *
 * Essa inversão é o que faz o produto caber no preço: 40 segundos de teatro
 * custam zero, e é o teatro que faz a resposta parecer cara. Fosse a IA
 * gerando o show, cada leitura custaria várias chamadas.
 *
 * ── Por que os símbolos são NOMEADOS ──────────────────────────────────────
 *
 * Porque a resposta tem que citá-los. Um espetáculo que devolvesse só um
 * número ("intensidade: 0.7") não daria à IA nada pra amarrar no texto, e o
 * ritual viraria enfeite — exatamente o que se quer evitar.
 */
export interface Simbolo {
  /** Como ele aparece na resposta: "A Torre", "Vênus em Escorpião". */
  nome: string;
  /** A posição/papel dele no espetáculo: "o que atravessa", "a casa do amor". */
  posicao: string;
  /** O sentido tradicional, que vai no prompt como matéria-prima. */
  sentido: string;
  /** `true` = veio do bônus de dia de ouro. */
  dourado?: boolean;
}

export interface ResultadoDoEspetaculo {
  espetaculo: EspetaculoId;
  nome: string;
  simbolos: Simbolo[];
  /** Dados extras pra animação — cada show usa o que precisa. */
  cena: Record<string, unknown>;
}

export type EspetaculoId = 'cartas' | 'ceu' | 'chama' | 'ossos' | 'dias';

export interface Espetaculo {
  id: EspetaculoId;
  nome: string;
  /** Quanto tempo a animação leva, em ms — é o que dá pra gastar cobrindo a latência da IA. */
  duracaoMs: number;
  /**
   * `semente` torna o resultado reproduzível: a mesma leitura reaberta mostra
   * as mesmas cartas. Sem isso não dá pra auditar nem pra reexibir.
   *
   * `diaDeOuro` acrescenta UM símbolo a mais — nunca troca os outros.
   */
  executar(ctx: ContextoDoEspetaculo): ResultadoDoEspetaculo;
}

export interface ContextoDoEspetaculo {
  semente: string;
  diaDeOuro: boolean;
  quando: Date;
  /** Presente quando a conta tem mapa natal — o céu e os dias precisam dele. */
  natal?: { sol: number; lua: number; ascendente: number | null } | null;
  /** A pontuação do dia, já calculada pelo Calendário. */
  pontuacaoDoDia?: Record<string, number> | null;
}

/**
 * Sorteio determinístico a partir de uma semente.
 *
 * `Math.random()` tornaria a leitura irreproduzível — reabrir mostraria
 * cartas diferentes, e o registro no banco viraria ficção. Este gerador é o
 * mulberry32: minúsculo, sem dependência, e bom o bastante para embaralhar
 * cartas (não é, nem precisa ser, criptográfico).
 */
export function geradorDe(semente: string): () => number {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) {
    h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  let estado = h >>> 0;
  return () => {
    estado |= 0;
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tira `quantos` itens sem repetir, usando o gerador. */
export function sortearSemRepetir<T>(itens: readonly T[], quantos: number, aleatorio: () => number): T[] {
  const copia = [...itens];
  const escolhidos: T[] = [];

  for (let i = 0; i < quantos && copia.length > 0; i++) {
    const indice = Math.floor(aleatorio() * copia.length);
    escolhidos.push(copia.splice(indice, 1)[0]);
  }

  return escolhidos;
}
