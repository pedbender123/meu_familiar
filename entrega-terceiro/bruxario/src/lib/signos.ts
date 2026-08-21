/**
 * Signo solar por data, para a roda que gira na tela.
 *
 * ── Por que a tabela de cúspides e não as efemérides ──────────────────────
 *
 * `astro.ts` calcula o signo de verdade, com `astronomy-engine`, e continua
 * sendo quem decide o que vai na leitura. Mas ele roda no servidor: a roda de
 * data precisa atualizar o signo a cada rolagem de dedo, sessenta vezes por
 * segundo, e nenhuma dessas atualizações pode custar uma ida à rede.
 *
 * A tabela abaixo erra no máximo um dia, e só em quem nasceu exatamente na
 * virada de um signo. Quando isso acontece, quem manda é o cálculo real feito
 * na criação do pedido — a roda é interface, não resultado.
 */
export interface SignoVisual {
  nome: string;
  simbolo: string;
  /** Dia do ano em que começa, no formato [mês (1-12), dia]. */
  de: [number, number];
}

export const SIGNOS_VISUAIS: SignoVisual[] = [
  { nome: 'Capricórnio', simbolo: '♑', de: [12, 22] },
  { nome: 'Aquário', simbolo: '♒', de: [1, 20] },
  { nome: 'Peixes', simbolo: '♓', de: [2, 19] },
  { nome: 'Áries', simbolo: '♈', de: [3, 21] },
  { nome: 'Touro', simbolo: '♉', de: [4, 20] },
  { nome: 'Gêmeos', simbolo: '♊', de: [5, 21] },
  { nome: 'Câncer', simbolo: '♋', de: [6, 21] },
  { nome: 'Leão', simbolo: '♌', de: [7, 23] },
  { nome: 'Virgem', simbolo: '♍', de: [8, 23] },
  { nome: 'Libra', simbolo: '♎', de: [9, 23] },
  { nome: 'Escorpião', simbolo: '♏', de: [10, 23] },
  { nome: 'Sagitário', simbolo: '♐', de: [11, 22] },
];

/** O signo de um mês (1-12) e dia. */
export function signoDe(mes: number, dia: number): SignoVisual {
  // De trás para frente: o primeiro cujo início já passou é o certo. Capricórnio
  // abre a lista porque atravessa a virada do ano, então ele é o padrão de
  // quem cair antes de 20 de janeiro.
  for (let i = SIGNOS_VISUAIS.length - 1; i >= 1; i--) {
    const [m, d] = SIGNOS_VISUAIS[i].de;
    if (mes > m || (mes === m && dia >= d)) return SIGNOS_VISUAIS[i];
  }
  return SIGNOS_VISUAIS[0];
}

/** Os vizinhos na roda — é o que dá a sensação de disco girando. */
export function vizinhosDe(signo: SignoVisual): {
  antes: SignoVisual;
  depois: SignoVisual;
} {
  const i = SIGNOS_VISUAIS.indexOf(signo);
  const n = SIGNOS_VISUAIS.length;
  return {
    antes: SIGNOS_VISUAIS[(i - 1 + n) % n],
    depois: SIGNOS_VISUAIS[(i + 1) % n],
  };
}
