import * as Astronomy from 'astronomy-engine';

/**
 * Efemérides e aspectos — a camada de astronomia do Calendário.
 *
 * ── Offline e determinístico, por decisão de margem ───────────────────────
 *
 * `astronomy-engine` já é dependência do projeto e devolve posição planetária
 * para qualquer data sem API, sem chave e sem custo. É isto que segura a
 * margem enquanto o Oráculo gasta: um plano anual manda calcular 365 dias, e
 * 365 dias de LLM seriam caros o bastante para inverter o preço do produto.
 *
 * Como não há chamada de rede, o custo de um ano inteiro é alguns milissegundos
 * de CPU — e o resultado é sempre o mesmo para a mesma entrada, o que torna a
 * pontuação testável com data fixa.
 */

/** Os corpos que interessam. Urano, Netuno e Plutão andam devagar demais para dizer algo sobre UM dia. */
export const PLANETAS = ['Sol', 'Lua', 'Mercúrio', 'Vênus', 'Marte', 'Júpiter', 'Saturno'] as const;
export type Planeta = (typeof PLANETAS)[number];

const CORPO: Record<Planeta, Astronomy.Body> = {
  Sol: Astronomy.Body.Sun,
  Lua: Astronomy.Body.Moon,
  'Mercúrio': Astronomy.Body.Mercury,
  'Vênus': Astronomy.Body.Venus,
  Marte: Astronomy.Body.Mars,
  'Júpiter': Astronomy.Body.Jupiter,
  Saturno: Astronomy.Body.Saturn,
};

/**
 * Os aspectos clássicos, com orbe e sinal.
 *
 * `harmonia` é o que a pontuação usa: trígono e sextil somam, quadratura e
 * oposição subtraem, conjunção amplifica o que já está lá (por isso é
 * neutra-positiva — conjunção de Vênus é ótima, de Saturno nem tanto, e quem
 * resolve isso é o peso do planeta, não o do aspecto).
 */
export interface Aspecto {
  nome: string;
  angulo: number;
  orbe: number;
  harmonia: number;
}

export const ASPECTOS: Aspecto[] = [
  { nome: 'conjunção', angulo: 0, orbe: 8, harmonia: 1 },
  { nome: 'sextil', angulo: 60, orbe: 4, harmonia: 1 },
  { nome: 'quadratura', angulo: 90, orbe: 6, harmonia: -1 },
  { nome: 'trígono', angulo: 120, orbe: 6, harmonia: 1 },
  { nome: 'oposição', angulo: 180, orbe: 8, harmonia: -1 },
];

/** Longitude eclíptica geocêntrica, em graus. */
export function longitudeDe(planeta: Planeta, quando: Date): number {
  if (planeta === 'Lua') return Astronomy.EclipticGeoMoon(quando).lon;

  const vetor = Astronomy.GeoVector(CORPO[planeta], quando, true);
  return Astronomy.Ecliptic(vetor).elon;
}

/** Distância angular entre duas longitudes, sempre em 0–180. */
export function separacao(a: number, b: number): number {
  const bruta = Math.abs(((a - b) % 360) + 360) % 360;
  return bruta > 180 ? 360 - bruta : bruta;
}

export interface AspectoEncontrado {
  aspecto: Aspecto;
  /** 0–1: quão exato está. Aspecto exato vale muito mais que um no limite do orbe. */
  forca: number;
}

/**
 * O aspecto entre duas posições, se houver.
 *
 * A força cai linearmente do centro até a borda do orbe. Sem isso, um aspecto
 * a 7,9° de orbe pesaria igual a um exato — e o calendário marcaria como "dia
 * de ouro" qualquer dia que tivesse muitos aspectos fracos, que é a maior
 * parte deles.
 */
export function aspectoEntre(longitudeA: number, longitudeB: number): AspectoEncontrado | null {
  const distancia = separacao(longitudeA, longitudeB);

  for (const aspecto of ASPECTOS) {
    const desvio = Math.abs(distancia - aspecto.angulo);
    if (desvio <= aspecto.orbe) {
      return { aspecto, forca: 1 - desvio / aspecto.orbe };
    }
  }
  return null;
}

/** As posições natais que a pontuação compara contra os trânsitos do dia. */
export interface MapaNatal {
  sol: number;
  lua: number;
  /** Só existe com hora confiável — ver `HORA_PADRAO`. */
  ascendente: number | null;
}

/**
 * O mapa natal a partir dos dados da conta.
 *
 * `horaAproximada` zera o ascendente em vez de calculá-lo com meio-dia: o
 * ascendente gira 360° em 24h, então com hora chutada ele é ficção. Melhor
 * não ter do que ter errado — um calendário que erra o ascendente erra todos
 * os dias, e a pessoa não tem como saber que o erro é esse.
 */
export function mapaNatal(dados: {
  data: string;
  hora: string;
  lat: number;
  lon: number;
  horaAproximada: boolean;
}): MapaNatal {
  // O fuso do Brasil está embutido no `-03:00`: o dado é coletado em horário
  // local, e tratá-lo como UTC deslocaria a Lua em três horas.
  const quando = new Date(`${dados.data}T${dados.hora}:00-03:00`);

  return {
    sol: longitudeDe('Sol', quando),
    lua: longitudeDe('Lua', quando),
    ascendente: dados.horaAproximada ? null : ascendenteEm(quando, dados.lat, dados.lon),
  };
}

/**
 * O ascendente: o grau da eclíptica que subia no horizonte leste.
 *
 * `astronomy-engine` não traz esta conta pronta, então ela vem da fórmula
 * clássica — arco tangente da relação entre o tempo sideral local e a
 * obliquidade, corrigido pela latitude.
 */
function ascendenteEm(quando: Date, lat: number, lon: number): number {
  const horasSiderais = Astronomy.SiderealTime(quando) + lon / 15;
  const tsl = ((horasSiderais * 15) % 360 + 360) % 360; // em graus
  const rad = Math.PI / 180;
  const obliquidade = 23.4392911 * rad;
  const latRad = lat * rad;
  const tslRad = tsl * rad;

  const y = -Math.cos(tslRad);
  const x =
    Math.sin(tslRad) * Math.cos(obliquidade) + Math.tan(latRad) * Math.sin(obliquidade);

  return ((Math.atan2(y, x) / rad) % 360 + 360) % 360;
}
