import * as Astronomy from 'astronomy-engine';

const SIGNOS = [
  'Áries',
  'Touro',
  'Gêmeos',
  'Câncer',
  'Leão',
  'Virgem',
  'Libra',
  'Escorpião',
  'Sagitário',
  'Capricórnio',
  'Aquário',
  'Peixes',
] as const;

export type Signo = (typeof SIGNOS)[number];

function longitudeParaSigno(elon: number): Signo {
  const normalizado = ((elon % 360) + 360) % 360;
  const indice = Math.floor(normalizado / 30);
  return SIGNOS[indice];
}

export interface Signos {
  signoSol: Signo;
  signoLua: Signo;
}

/**
 * Calcula signo solar e lunar de forma offline e determinística.
 * dataNascimento: 'YYYY-MM-DD'; horaNascimento: 'HH:mm' (opcional, padrão 12:00).
 * Assume horário de Brasília (UTC-3) já que o público é do Brasil.
 */
export function calcularSignos(
  dataNascimento: string,
  horaNascimento?: string
): Signos {
  const sol = Astronomy.SunPosition(momentoDe(dataNascimento, horaNascimento));
  const lua = Astronomy.EclipticGeoMoon(momentoDe(dataNascimento, horaNascimento));

  return {
    signoSol: longitudeParaSigno(sol.elon),
    signoLua: longitudeParaSigno(lua.lon),
  };
}

function momentoDe(data: string, hora?: string): Date {
  const h = hora && /^\d{2}:\d{2}$/.test(hora) ? hora : '12:00';
  return new Date(`${data}T${h}:00-03:00`);
}

export type FaseDaLua = 'nova' | 'crescente' | 'cheia' | 'minguante';

/**
 * A fase da lua no nascimento.
 *
 * Antes isso era uma **pergunta** do quiz ("que lua te encontra acordada?"),
 * o que media preferência estética, não fato. Calculada, ela vira parte do
 * retrato — "nascida sob lua minguante" — e conversa com os signos, que já
 * vêm do mesmo instante. De quebra, é uma pergunta a menos num teste que
 * cresceu de 8 para 26 itens.
 *
 * `MoonPhase` devolve a elongação em graus: 0° lua nova, 90° quarto
 * crescente, 180° cheia, 270° quarto minguante. As faixas abaixo são os
 * quatro quartos centrados nesses marcos.
 */
export function calcularFaseDaLua(
  dataNascimento: string,
  horaNascimento?: string
): FaseDaLua {
  const graus = Astronomy.MoonPhase(momentoDe(dataNascimento, horaNascimento));

  if (graus < 45 || graus >= 315) return 'nova';
  if (graus < 135) return 'crescente';
  if (graus < 225) return 'cheia';
  return 'minguante';
}
