/**
 * Coordenadas por estado — a capital de cada um.
 *
 * ── Por que a capital, e não a cidade exata ───────────────────────────────
 *
 * `cidades.json` tem 5.500 municípios e **nenhuma coordenada**. Embarcar uma
 * base geocodificada inteira para isto seria megabytes por um ganho que o
 * produto não usa.
 *
 * O que a coordenada decide no mapa natal é o **ascendente** e as casas. O
 * ascendente anda ~1° a cada 4 minutos de tempo sideral, e a longitude
 * converte em tempo a 4 minutos por grau — então errar 300 km em longitude
 * (o raio típico de um estado brasileiro) desloca o ascendente em poucos
 * graus, quase sempre dentro do mesmo signo. Errar a HORA em meia hora custa
 * mais que isso, e a hora é informada pela pessoa de memória.
 *
 * Ou seja: a capital do estado é precisa o bastante para o que se entrega, e
 * a alternativa realista não era "mais preciso", era "não ter calendário".
 * Quando houver motivo (e uma base com coordenadas), trocar isto é local —
 * só esta função muda.
 */
export interface Coordenada {
  lat: number;
  lon: number;
}

const CAPITAIS: Record<string, Coordenada> = {
  AC: { lat: -9.9754, lon: -67.8249 }, // Rio Branco
  AL: { lat: -9.6498, lon: -35.7089 }, // Maceió
  AM: { lat: -3.119, lon: -60.0217 }, // Manaus
  AP: { lat: 0.0349, lon: -51.0694 }, // Macapá
  BA: { lat: -12.9777, lon: -38.5016 }, // Salvador
  CE: { lat: -3.7319, lon: -38.5267 }, // Fortaleza
  DF: { lat: -15.7975, lon: -47.8919 }, // Brasília
  ES: { lat: -20.3155, lon: -40.3128 }, // Vitória
  GO: { lat: -16.6869, lon: -49.2648 }, // Goiânia
  MA: { lat: -2.5297, lon: -44.3028 }, // São Luís
  MG: { lat: -19.9167, lon: -43.9345 }, // Belo Horizonte
  MS: { lat: -20.4697, lon: -54.6201 }, // Campo Grande
  MT: { lat: -15.601, lon: -56.0974 }, // Cuiabá
  PA: { lat: -1.4558, lon: -48.4902 }, // Belém
  PB: { lat: -7.1195, lon: -34.845 }, // João Pessoa
  PE: { lat: -8.0476, lon: -34.877 }, // Recife
  PI: { lat: -5.0892, lon: -42.8019 }, // Teresina
  PR: { lat: -25.4284, lon: -49.2733 }, // Curitiba
  RJ: { lat: -22.9068, lon: -43.1729 }, // Rio de Janeiro
  RN: { lat: -5.7945, lon: -35.211 }, // Natal
  RO: { lat: -8.7612, lon: -63.9004 }, // Porto Velho
  RR: { lat: 2.8235, lon: -60.6758 }, // Boa Vista
  RS: { lat: -30.0346, lon: -51.2177 }, // Porto Alegre
  SC: { lat: -27.5954, lon: -48.548 }, // Florianópolis
  SE: { lat: -10.9472, lon: -37.0731 }, // Aracaju
  SP: { lat: -23.5505, lon: -46.6333 }, // São Paulo
  TO: { lat: -10.2491, lon: -48.3243 }, // Palmas
};

/** `null` para sigla desconhecida — quem chama decide, ninguém chuta Brasília. */
export function coordenadaDoEstado(sigla: string): Coordenada | null {
  return CAPITAIS[sigla?.trim().toUpperCase()] ?? null;
}

export const ESTADOS = Object.keys(CAPITAIS).sort();
