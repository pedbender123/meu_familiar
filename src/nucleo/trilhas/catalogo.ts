/**
 * As trilhas de fundo — o catálogo.
 *
 * ── O que isto é, no produto ──────────────────────────────────────────────
 *
 * Um tocador pequeno que segue a pessoa pela plataforma inteira: ela lê a
 * revelação com chuva ao fundo, faz a pergunta ao Oráculo com a mesma chuva,
 * abre um livro e o capítulo troca a trilha sozinho. É o mesmo som que já
 * existia por trás do site — o que mudou é ele ter nome, lista e escolha.
 *
 * ── Por que existe uma lista, se hoje há duas faixas ──────────────────────
 *
 * Porque a lista é o produto. Duas ou três abertas para todo mundo, o resto
 * incluído na assinatura: é a mesma escada dos livros, e ela precisa estar
 * montada antes de ter vinte faixas, senão a vigésima chega e não há onde
 * pendurar.
 *
 * ── Faixa sem arquivo não existe ──────────────────────────────────────────
 *
 * A mesma regra dos ebooks (`ebookEntregavel`): o catálogo declara o que se
 * pretende ter, e `trilhasNoAr` só devolve o que está em disco. Prometer uma
 * faixa que não toca é pior do que não prometer nada — e é o erro que uma
 * lista escrita à frente do conteúdo comete sozinha.
 */

export interface Trilha {
  id: string;
  nome: string;
  /** Uma linha, no tom do resto: é legenda de grimório, não de banco de sons. */
  descricao: string;
  /** Caminho servido pelo navegador, a partir de `public/`. */
  arquivo: string;
  /** Aberta para quem tem conta, sem assinatura. */
  gratuita: boolean;
}

/**
 * Os ids são os mesmos que os capítulos dos livros pedem em `som:`. Um livro
 * que pede uma faixa que ainda não existe lê em silêncio, sem quebrar — ver
 * `nucleo/biblioteca/formato.ts`.
 */
export const TRILHAS: Trilha[] = [
  {
    id: 'chuva-longe',
    nome: 'Chuva ao longe',
    descricao: 'A tempestade que passa do lado de fora da janela.',
    arquivo: '/audio/chuva.mp3',
    gratuita: true,
  },
  {
    id: 'fogo-crepitar',
    nome: 'Fogo crepitando',
    descricao: 'A vela que não apaga enquanto você lê.',
    arquivo: '/audio/vela.mp3',
    gratuita: true,
  },
  {
    id: 'respiracao',
    nome: 'Respiração',
    descricao: 'Quatro tempos para dentro, seis para fora. Só isso.',
    arquivo: '/audio/trilhas/respiracao.mp3',
    gratuita: false,
  },
  {
    id: 'silencio-com-vento',
    nome: 'Silêncio com vento',
    descricao: 'O quase-nada, para quem não consegue ler com música.',
    arquivo: '/audio/trilhas/silencio-com-vento.mp3',
    gratuita: false,
  },
  {
    id: 'agua-corrente',
    nome: 'Água corrente',
    descricao: 'O riacho que não repete a mesma nota duas vezes.',
    arquivo: '/audio/trilhas/agua-corrente.mp3',
    gratuita: false,
  },
  {
    id: 'floresta-noite',
    nome: 'Floresta à noite',
    descricao: 'Grilos, folhas, e alguma coisa andando longe.',
    arquivo: '/audio/trilhas/floresta-noite.mp3',
    gratuita: false,
  },
  {
    id: 'tigela-tibetana',
    nome: 'Tigela tibetana',
    descricao: 'Uma nota que demora a morrer, de tempos em tempos.',
    arquivo: '/audio/trilhas/tigela-tibetana.mp3',
    gratuita: false,
  },
  {
    id: 'batida-lenta',
    nome: 'Batida lenta',
    descricao: 'Sessenta por minuto — o passo de um coração em paz.',
    arquivo: '/audio/trilhas/batida-lenta.mp3',
    gratuita: false,
  },
];

export function trilhaPorId(id: string | null | undefined): Trilha | null {
  if (!id) return null;
  return TRILHAS.find((t) => t.id === id) ?? null;
}

/**
 * O que a pessoa pode ouvir, dado o que ela tem.
 *
 * Assinante ouve tudo; quem não assina ouve as gratuitas e **vê** as outras.
 * Ver, e não esconder: uma lista que só mostra o que já é seu não vende nada,
 * e a faixa trancada com nome e descrição é a própria oferta.
 */
export function podeOuvir(trilha: Trilha, assinaturaAtiva: boolean): boolean {
  return trilha.gratuita || assinaturaAtiva;
}
