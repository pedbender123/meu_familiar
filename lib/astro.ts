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
  const hora = horaNascimento && /^\d{2}:\d{2}$/.test(horaNascimento) ? horaNascimento : '12:00';
  const dataHoraLocal = new Date(`${dataNascimento}T${hora}:00-03:00`);

  const sol = Astronomy.SunPosition(dataHoraLocal);
  const lua = Astronomy.EclipticGeoMoon(dataHoraLocal);

  return {
    signoSol: longitudeParaSigno(sol.elon),
    signoLua: longitudeParaSigno(lua.lon),
  };
}
