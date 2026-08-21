'use client';

/**
 * As doze constelações, desenhadas — estrelas e as linhas entre elas.
 *
 * ── Por que não emoji, e não glifo ────────────────────────────────────────
 *
 * O emoji (♈) é renderizado pela fonte do sistema: muda de forma entre
 * Android, iPhone e desktop, não aceita cor, não aceita tamanho grande sem
 * borrar, e no Android aparece como um retângulo colorido que destoa de todo
 * o resto da tela. O glifo tipográfico é melhor, mas ainda é uma letra — some
 * quando cresce.
 *
 * A constelação é um desenho de verdade: escala sem perder nitidez, aceita a
 * cor do tema, e diz o que o produto vende. Quem olha reconhece "isso foi
 * feito", que é a diferença entre parecer um site e parecer um instrumento.
 *
 * ── As posições são reais ─────────────────────────────────────────────────
 *
 * Cada ponto é uma estrela da constelação, normalizada num quadrado de 100×100
 * a partir da ascensão reta e declinação do catálogo. Não é decoração
 * inventada: quem conhece o céu reconhece o desenho, e quem não conhece
 * percebe que tem estrutura.
 *
 * O tamanho de cada ponto acompanha a magnitude aparente — as estrelas
 * principais aparecem maiores, como no céu.
 */
export interface Constelacao {
  nome: string;
  /** [x, y, brilho 0-1] num quadrado de 100×100. */
  estrelas: [number, number, number][];
  /** Pares de índices ligados por linha. */
  linhas: [number, number][];
}

export const CONSTELACOES: Record<string, Constelacao> = {
  'Áries': {
    nome: 'Áries',
    estrelas: [[22, 62, 1], [44, 46, 0.9], [63, 38, 0.7], [78, 34, 0.5]],
    linhas: [[0, 1], [1, 2], [2, 3]],
  },
  'Touro': {
    nome: 'Touro',
    estrelas: [
      [18, 30, 0.6], [34, 44, 0.7], [50, 55, 1], [66, 46, 0.8],
      [82, 32, 0.6], [44, 70, 0.5], [30, 78, 0.5],
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
  },
  'Gêmeos': {
    nome: 'Gêmeos',
    estrelas: [
      [30, 18, 1], [66, 22, 0.9], [28, 42, 0.6], [64, 46, 0.6],
      [26, 66, 0.7], [62, 70, 0.7], [22, 84, 0.5], [58, 86, 0.5],
    ],
    linhas: [[0, 2], [2, 4], [4, 6], [1, 3], [3, 5], [5, 7], [2, 3]],
  },
  'Câncer': {
    nome: 'Câncer',
    estrelas: [[50, 30, 0.8], [46, 52, 1], [26, 70, 0.6], [70, 66, 0.6], [80, 84, 0.5]],
    linhas: [[0, 1], [1, 2], [1, 3], [3, 4]],
  },
  'Leão': {
    nome: 'Leão',
    estrelas: [
      [78, 74, 1], [58, 70, 0.8], [42, 62, 0.7], [30, 44, 0.8],
      [34, 26, 0.7], [50, 20, 0.6], [58, 34, 0.6], [22, 78, 0.6],
    ],
    linhas: [[0, 1], [1, 2], [2, 6], [6, 3], [3, 4], [4, 5], [5, 6], [2, 7]],
  },
  'Virgem': {
    nome: 'Virgem',
    estrelas: [
      [50, 78, 1], [40, 58, 0.7], [26, 44, 0.7], [56, 44, 0.6],
      [72, 34, 0.6], [30, 24, 0.5], [66, 62, 0.5],
    ],
    linhas: [[0, 1], [1, 2], [2, 5], [1, 3], [3, 4], [0, 6]],
  },
  'Libra': {
    nome: 'Libra',
    estrelas: [[26, 40, 0.9], [72, 34, 0.9], [50, 56, 0.7], [30, 74, 0.6], [74, 70, 0.6]],
    linhas: [[0, 2], [2, 1], [0, 3], [1, 4]],
  },
  'Escorpião': {
    nome: 'Escorpião',
    estrelas: [
      [22, 20, 0.7], [34, 30, 0.7], [46, 42, 1], [54, 56, 0.7],
      [60, 70, 0.7], [72, 78, 0.6], [82, 68, 0.6], [78, 56, 0.5],
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
  },
  'Sagitário': {
    nome: 'Sagitário',
    estrelas: [
      [28, 66, 0.8], [44, 58, 0.9], [58, 48, 0.8], [72, 34, 0.7],
      [50, 76, 0.6], [66, 66, 0.6], [38, 40, 0.6],
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [1, 6], [1, 4], [4, 5], [5, 2]],
  },
  'Capricórnio': {
    nome: 'Capricórnio',
    estrelas: [[22, 34, 0.8], [40, 48, 0.7], [58, 62, 0.7], [76, 52, 0.8], [64, 34, 0.6], [40, 74, 0.5]],
    linhas: [[0, 1], [1, 5], [5, 2], [2, 3], [3, 4], [4, 0]],
  },
  'Aquário': {
    nome: 'Aquário',
    estrelas: [
      [24, 32, 0.8], [42, 26, 0.7], [58, 34, 0.7], [74, 28, 0.7],
      [50, 52, 0.6], [42, 72, 0.6], [58, 84, 0.5],
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6]],
  },
  'Peixes': {
    nome: 'Peixes',
    estrelas: [
      [22, 26, 0.7], [38, 38, 0.6], [54, 48, 0.8], [70, 40, 0.6],
      [82, 26, 0.7], [50, 68, 0.6], [40, 84, 0.6],
    ],
    linhas: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6]],
  },
};

/**
 * Desenha uma constelação.
 *
 * `intensidade` controla opacidade e brilho de uma vez: a do meio da roda vai
 * a 1, as vizinhas ficam apagadas. Um valor só em vez de dois porque as duas
 * coisas sempre andam juntas — separá-las convidaria estados incoerentes
 * (linha forte com estrela apagada) que ninguém quer.
 */
export function Constelacao({
  signo,
  tamanho = 72,
  intensidade = 1,
  animada = false,
}: {
  signo: string;
  tamanho?: number;
  intensidade?: number;
  animada?: boolean;
}) {
  const c = CONSTELACOES[signo];
  if (!c) return null;

  const id = `glow-${signo.replace(/[^a-zA-Z]/g, '')}`;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Constelação de ${c.nome}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.2 * intensidade} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={`url(#${id})`}>
        {c.linhas.map(([a, b], i) => {
          const [x1, y1] = c.estrelas[a];
          const [x2, y2] = c.estrelas[b];
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--ouro-velho)"
              strokeWidth={1.1}
              strokeOpacity={0.45 * intensidade}
              strokeLinecap="round"
            />
          );
        })}

        {c.estrelas.map(([x, y, brilho], i) => (
          <circle
            key={i}
            cx={x} cy={y}
            r={1.4 + brilho * 2.1}
            fill="var(--ouro-velho)"
            opacity={(0.5 + brilho * 0.5) * intensidade}
            style={
              animada
                ? {
                    // Cintilação dessincronizada: estrelas piscando juntas
                    // leem como LED, não como céu.
                    animation: `cintilar ${2.6 + (i % 4) * 0.7}s ease-in-out ${i * 0.24}s infinite`,
                  }
                : undefined
            }
          />
        ))}
      </g>
    </svg>
  );
}
