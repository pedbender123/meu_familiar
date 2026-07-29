import {
  IconZodiacAries,
  IconZodiacTaurus,
  IconZodiacGemini,
  IconZodiacCancer,
  IconZodiacLeo,
  IconZodiacVirgo,
  IconZodiacLibra,
  IconZodiacScorpio,
  IconZodiacSagittarius,
  IconZodiacCapricorn,
  IconZodiacAquarius,
  IconZodiacPisces,
} from '@tabler/icons-react';
import type { Signo } from '@/lib/astro';

interface IconeProps {
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}

const ICONE_POR_SIGNO: Record<Signo, React.ComponentType<IconeProps>> = {
  Áries: IconZodiacAries,
  Touro: IconZodiacTaurus,
  Gêmeos: IconZodiacGemini,
  Câncer: IconZodiacCancer,
  Leão: IconZodiacLeo,
  Virgem: IconZodiacVirgo,
  Libra: IconZodiacLibra,
  Escorpião: IconZodiacScorpio,
  Sagitário: IconZodiacSagittarius,
  Capricórnio: IconZodiacCapricorn,
  Aquário: IconZodiacAquarius,
  Peixes: IconZodiacPisces,
};

export function GlifoZodiaco({ signo, ...props }: { signo: Signo } & IconeProps) {
  const Icone = ICONE_POR_SIGNO[signo];
  return <Icone {...props} />;
}
