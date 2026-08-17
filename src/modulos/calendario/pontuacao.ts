import {
  PLANETAS,
  aspectoEntre,
  longitudeDe,
  type MapaNatal,
  type Planeta,
} from './transitos';

/**
 * A pontuação por domínio — o coração do Calendário, e uma função pura.
 *
 * Recebe mapa natal e data, devolve quatro números. Sem banco, sem rede, sem
 * relógio: a mesma entrada devolve sempre a mesma saída, o que é o que
 * permite testar "3 de março de 2026 dá tal coisa" com data fixa.
 */
export const DOMINIOS = ['amor', 'carreira', 'viagens', 'fortuna'] as const;
export type Dominio = (typeof DOMINIOS)[number];

export const NOME_DO_DOMINIO: Record<Dominio, string> = {
  amor: 'Amor',
  carreira: 'Carreira',
  viagens: 'Viagens',
  fortuna: 'Fortuna',
};

/**
 * Quanto cada planeta pesa em cada domínio.
 *
 * A atribuição é a tradicional, e a escolha de manter Saturno pesando
 * NEGATIVO só em carreira é deliberada: Saturno é o planeta do limite e da
 * cobrança, e um calendário que o trata como "ruim em tudo" marcaria metade
 * do ano como dia ruim — o que não ajuda ninguém a decidir nada.
 */
const PESOS: Record<Dominio, Partial<Record<Planeta, number>>> = {
  amor: { 'Vênus': 3, Lua: 2, Marte: 1, Sol: 0.5 },
  carreira: { Sol: 2, Marte: 2, 'Júpiter': 1.5, Saturno: 1.5, 'Mercúrio': 1 },
  viagens: { 'Júpiter': 3, 'Mercúrio': 2, Sol: 1, Lua: 0.5 },
  fortuna: { 'Júpiter': 3, 'Vênus': 2, Sol: 1, Saturno: 1 },
};

/** Os pontos natais e quanto cada um importa. O Sol e a Lua são o retrato; o ascendente, a porta. */
const PESO_NATAL: Record<keyof MapaNatal, number> = {
  sol: 1,
  lua: 1,
  ascendente: 0.8,
};

export type PontuacaoDoDia = Record<Dominio, number>;

/**
 * Nota de 0 a 100 por domínio, para um dia.
 *
 * O cálculo bruto soma `peso × harmonia × força` de todo aspecto entre um
 * planeta em trânsito e um ponto natal. Isso dá um número sem escala fixa,
 * que depende de quantos aspectos calharam de existir — então ele é
 * normalizado por uma tangente hiperbólica, que comprime qualquer extremo
 * para 0–100 sem cortar (um dia excepcional continua acima de um dia bom, em
 * vez de os dois baterem no teto).
 *
 * 50 é o dia neutro: nenhum aspecto relevante.
 */
export function pontuarDia(natal: MapaNatal, quando: Date): PontuacaoDoDia {
  // Uma leitura de posição por planeta, reaproveitada nos quatro domínios —
  // sem isto seriam 28 cálculos de efeméride por dia em vez de 7, e o plano
  // anual multiplica isso por 365.
  const transitos = new Map<Planeta, number>();
  for (const planeta of PLANETAS) {
    transitos.set(planeta, longitudeDe(planeta, quando));
  }

  const pontuacao = {} as PontuacaoDoDia;

  for (const dominio of DOMINIOS) {
    let bruto = 0;

    for (const [planeta, peso] of Object.entries(PESOS[dominio]) as [Planeta, number][]) {
      const longitudeTransito = transitos.get(planeta)!;

      for (const ponto of ['sol', 'lua', 'ascendente'] as const) {
        const longitudeNatal = natal[ponto];
        if (longitudeNatal === null) continue;

        const encontrado = aspectoEntre(longitudeTransito, longitudeNatal);
        if (!encontrado) continue;

        bruto +=
          peso * PESO_NATAL[ponto] * encontrado.aspecto.harmonia * encontrado.forca;
      }
    }

    pontuacao[dominio] = Math.round(50 + 50 * Math.tanh(bruto / 6));
  }

  return pontuacao;
}

/** O domínio mais forte do dia — o que a tela destaca. */
export function destaqueDo(pontuacao: PontuacaoDoDia): { dominio: Dominio; nota: number } {
  let melhor: Dominio = 'amor';
  for (const dominio of DOMINIOS) {
    if (pontuacao[dominio] > pontuacao[melhor]) melhor = dominio;
  }
  return { dominio: melhor, nota: pontuacao[melhor] };
}

export type Classe = 'ouro' | 'bom' | 'neutro' | 'recolher';

/**
 * Acima de 70 é ouro; abaixo de 35, recolher.
 *
 * Os cortes não são simétricos de propósito: dizer "hoje é ruim" é uma
 * afirmação mais cara que dizer "hoje é bom", porque a pessoa pode deixar de
 * fazer algo por causa dela. O produto prefere errar para o lado de não
 * alarmar.
 */
export function classificar(nota: number): Classe {
  if (nota >= 70) return 'ouro';
  if (nota >= 58) return 'bom';
  if (nota >= 35) return 'neutro';
  return 'recolher';
}

/**
 * **Dia de ouro é sorte em TUDO**, não num assunto só.
 *
 * A primeira versão marcava como ouro qualquer dia cujo domínio mais forte
 * passasse de 70 — e isso pintava de dourado um dia que era ótimo no amor e
 * péssimo no resto, o que é uma promessa que o dia não cumpre. Ouro passa a
 * exigir as quatro portas abertas ao mesmo tempo: nenhum domínio abaixo de
 * 58, e a média alta.
 *
 * Isso torna o dia de ouro **raro**, que é o ponto — cor de destaque que
 * aparece toda semana deixa de destacar.
 */
export function ehDiaDeOuro(pontuacao: PontuacaoDoDia): boolean {
  const notas = DOMINIOS.map((d) => pontuacao[d]);
  return Math.min(...notas) >= 58 && media(notas) >= 66;
}

/** O oposto: todas as portas fechadas. */
export function ehDiaFechado(pontuacao: PontuacaoDoDia): boolean {
  return Math.max(...DOMINIOS.map((d) => pontuacao[d])) < 40;
}

export function media(numeros: number[]): number {
  if (numeros.length === 0) return 50;
  return Math.round(numeros.reduce((a, b) => a + b, 0) / numeros.length);
}

/** A nota agregada de um período, por domínio + a geral. */
export function agregar(
  pontuacoes: PontuacaoDoDia[]
): { porDominio: PontuacaoDoDia; geral: number } {
  const porDominio = {} as PontuacaoDoDia;
  for (const dominio of DOMINIOS) {
    porDominio[dominio] = media(pontuacoes.map((p) => p[dominio]));
  }
  return { porDominio, geral: media(DOMINIOS.map((d) => porDominio[d])) };
}
