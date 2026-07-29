import zodiacoPaths from './zodiaco-paths.json';
import type { Signo } from './astro';

/** Paths SVG (viewBox 0 0 24 24, stroke) extraídos do set @tabler/icons-react zodiac-*. */
export const ZODIACO_PATHS: Record<Signo, string[]> = zodiacoPaths as Record<
  Signo,
  string[]
>;

export function glifoSvg(
  signo: Signo,
  opts: { tamanho?: number; cor?: string; strokeWidth?: number } = {}
): string {
  const { tamanho = 24, cor = '#EAE0CC', strokeWidth = 2 } = opts;
  const paths = ZODIACO_PATHS[signo]
    .map((d) => `<path d="${d}" />`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
