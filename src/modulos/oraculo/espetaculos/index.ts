import { cartas } from './cartas';
import { ceu } from './ceu';
import {
  geradorDe,
  sortearSemRepetir,
  type Espetaculo,
  type EspetaculoId,
  type ContextoDoEspetaculo,
  type ResultadoDoEspetaculo,
} from './tipos';

export type { Espetaculo, EspetaculoId, ContextoDoEspetaculo, ResultadoDoEspetaculo };
export type { Simbolo } from './tipos';

/**
 * O elenco.
 *
 * Começa com dois — cartas e céu. Os outros três (`chama`, `ossos`, `dias`)
 * entram depois, e entram sem tocar em nada aqui: é só acrescentar à lista.
 * Essa é a razão de o espetáculo ser uma interface e não um `switch`.
 *
 * Com 2 no elenco há só 2 pares ordenados, então as primeiras leituras vão
 * repetir. Com 5, são 20 — e é aí que a variedade aparece de verdade.
 */
export const ESPETACULOS: Espetaculo[] = [cartas, ceu];

export function buscarEspetaculo(id: EspetaculoId): Espetaculo | undefined {
  return ESPETACULOS.find((e) => e.id === id);
}

/**
 * Sorteia **dois** espetáculos, em ordem qualquer, e executa.
 *
 * A ordem importa pro ritmo: o primeiro abre, o segundo aprofunda. Como é
 * sorteada, a mesma dupla em ordens diferentes já dá uma leitura com outra
 * cara — e é por isso que são pares ORDENADOS, não combinações.
 *
 * Tudo aqui é determinístico pela semente: a mesma leitura reaberta mostra o
 * mesmo show. Sem isso o registro no banco viraria ficção e não daria pra
 * auditar nem reexibir.
 */
export function sortearEspetaculos(ctx: ContextoDoEspetaculo): ResultadoDoEspetaculo[] {
  const aleatorio = geradorDe(`${ctx.semente}:elenco`);
  const escolhidos = sortearSemRepetir(
    ESPETACULOS,
    Math.min(2, ESPETACULOS.length),
    aleatorio
  );

  return escolhidos.map((espetaculo) => espetaculo.executar(ctx));
}

/** Quanto tempo o teatro inteiro leva — é o orçamento pra esconder a latência da IA. */
export function duracaoTotalMs(resultados: ResultadoDoEspetaculo[]): number {
  return resultados.reduce(
    (soma, r) => soma + (buscarEspetaculo(r.espetaculo)?.duracaoMs ?? 0),
    0
  );
}
