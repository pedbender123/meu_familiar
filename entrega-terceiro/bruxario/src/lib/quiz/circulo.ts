import type { FamiliarId } from '../familiares';

/**
 * Posição dos 12 familiares no circumplexo interpessoal (SPEC 2.2).
 *
 * O ângulo é medido a partir do eixo +Agência, no sentido anti-horário rumo a
 * +Comunhão. Cada familiar fica a 30° do vizinho, como o SPEC pede.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │              90° Cervo                                       │
 * │      120° Mariposa    60° Lobo                               │
 * │  150° Sapo                 30° Lebre                         │
 * │ 180° Morcego ───────────────── 0° Raposa   → +Agência        │
 * │  210° Coruja               330° Corvo                        │
 * │      240° Aranha      300° Serpente                          │
 * │              270° Gata Preta                                 │
 * └──────────────────────────────────────────────────────────────┘
 *
 * **Isto é a proposta do SPEC, não verdade medida.** O próprio documento diz
 * "a validar com dados reais, não é dogma", e a seção 2.5 dá o critério de
 * revisão: se um familiar levar 30% da base e outro 1%, o posicionamento está
 * errado. Duas posições já saíram apertadas ao encaixar a tabela do SPEC numa
 * grade de 30°:
 *
 *  - **Aranha** (240°) — o SPEC lhe dá agência *média*, mas 240° implica
 *    agência baixa. Ficou aqui porque a alternativa empurrava a Gata Preta
 *    para fora do quadrante dela.
 *  - **Gata Preta** (270°) — o SPEC lhe dá agência *média-alta*, e 270° é
 *    agência neutra.
 *
 * Ambas são candidatas naturais ao primeiro ajuste quando houver base.
 */
export const ANGULO_DO_FAMILIAR: Record<FamiliarId, number> = {
  raposa: 0,
  lebre: 30,
  lobo: 60,
  cervo: 90,
  mariposa: 120,
  sapo: 150,
  morcego: 180,
  coruja: 210,
  aranha: 240,
  'gata-preta': 270,
  serpente: 300,
  corvo: 330,
};

export const FAMILIARES_NO_CIRCULO = Object.keys(ANGULO_DO_FAMILIAR) as FamiliarId[];

const GRAUS_PARA_RAD = Math.PI / 180;

/** Distância angular entre dois ângulos em graus, sempre em [0, 180]. */
export function distanciaAngular(a: number, b: number): number {
  const bruta = Math.abs(((a - b) % 360) + 360) % 360;
  return bruta > 180 ? 360 - bruta : bruta;
}

/**
 * Converte agência/comunhão normalizados em ângulo (graus, [0, 360)) e
 * magnitude.
 *
 * A magnitude importa tanto quanto o ângulo, e por um motivo que não é óbvio:
 * quem responde perto do centro do círculo não é "meio Corvo" — é alguém cujo
 * perfil o teste não distinguiu bem. O `r` é o que permite dizer isso em vez
 * de fingir precisão.
 */
export function paraPolar(agencia: number, comunhao: number): {
  angulo: number;
  magnitude: number;
} {
  const magnitude = Math.hypot(agencia, comunhao);
  const anguloRad = Math.atan2(comunhao, agencia);
  const angulo = (((anguloRad / GRAUS_PARA_RAD) % 360) + 360) % 360;
  return { angulo, magnitude };
}

export interface Afinidade {
  familiar: FamiliarId;
  /** 0 a 100. Quanto o perfil se aproxima deste arquétipo. */
  escore: number;
  /** Distância angular em graus, para auditoria. */
  distancia: number;
}

/**
 * Os 12 escores de afinidade (SPEC 2.4, item 5 — travado em 0.8).
 *
 * A conversão de distância angular para escore é linear: 0° vira 100, 180°
 * vira 0. Escolha deliberada sobre alternativas mais "sofisticadas" (cosseno,
 * gaussiana): linear é explicável em uma frase na página pública de método, e
 * qualquer curva mais dura inflaria o vencedor e faria a roda dos 12 parecer
 * mais decidida do que o dado permite.
 *
 * Devolve sempre os 12, ordenados do mais próximo ao mais distante.
 */
export function afinidades(angulo: number): Afinidade[] {
  return FAMILIARES_NO_CIRCULO.map((familiar) => {
    const distancia = distanciaAngular(angulo, ANGULO_DO_FAMILIAR[familiar]);
    return {
      familiar,
      distancia,
      escore: Math.round(((180 - distancia) / 180) * 1000) / 10,
    };
  }).sort((a, b) => a.distancia - b.distancia);
}
