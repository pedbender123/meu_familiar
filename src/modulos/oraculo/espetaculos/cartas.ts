import {
  geradorDe,
  sortearSemRepetir,
  type Espetaculo,
  type ContextoDoEspetaculo,
  type ResultadoDoEspetaculo,
  type Simbolo,
} from './tipos';

/**
 * As cartas — os 22 arcanos maiores.
 *
 * Só os maiores, não os 78: cada arcano maior tem peso simbólico próprio e
 * dá matéria-prima farta pra IA amarrar no conselho. Os menores (copas,
 * espadas...) exigiriam conhecer combinações de naipe pra dizer algo, e o
 * ganho não paga a complexidade.
 *
 * O sentido de cada carta vai no prompt. **Sem ele a IA inventa** — e
 * inventaria diferente a cada leitura, o que quebraria a coerência de alguém
 * que tira a mesma carta duas vezes em meses diferentes.
 */
const ARCANOS = [
  { nome: 'O Louco', sentido: 'começo sem garantia, o salto antes de saber onde pisa' },
  { nome: 'O Mago', sentido: 'ter em mãos o que precisa; poder de realizar' },
  { nome: 'A Sacerdotisa', sentido: 'o que se sabe sem conseguir explicar; segredo guardado' },
  { nome: 'A Imperatriz', sentido: 'abundância, cuidado, o que cresce quando se rega' },
  { nome: 'O Imperador', sentido: 'estrutura, limite, a autoridade que protege e aprisiona' },
  { nome: 'O Hierofante', sentido: 'tradição, o conselho de quem veio antes; regra herdada' },
  { nome: 'Os Amantes', sentido: 'escolha que exige abrir mão; união e o preço dela' },
  { nome: 'O Carro', sentido: 'avanço por vontade; conduzir forças opostas na mesma direção' },
  { nome: 'A Força', sentido: 'domínio pela gentileza, não pela violência; coragem quieta' },
  { nome: 'O Eremita', sentido: 'recolhimento necessário; a resposta que só vem no silêncio' },
  { nome: 'A Roda da Fortuna', sentido: 'virada de ciclo; o que muda sem pedir licença' },
  { nome: 'A Justiça', sentido: 'consequência exata; a conta que chega' },
  { nome: 'O Enforcado', sentido: 'espera imposta; ver de cabeça pra baixo o que estava travado' },
  { nome: 'A Morte', sentido: 'fim que abre espaço — nunca literal; transformação sem volta' },
  { nome: 'A Temperança', sentido: 'medida, mistura, paciência que cura' },
  { nome: 'O Diabo', sentido: 'o que prende porque dá prazer; corrente que a pessoa segura' },
  { nome: 'A Torre', sentido: 'ruptura súbita do que estava mal construído; alívio disfarçado de desastre' },
  { nome: 'A Estrela', sentido: 'esperança depois do estrago; orientação de longe' },
  { nome: 'A Lua', sentido: 'confusão, medo antigo, o que a imaginação aumenta no escuro' },
  { nome: 'O Sol', sentido: 'clareza, alegria sem culpa, ser visto como se é' },
  { nome: 'O Julgamento', sentido: 'chamado que não dá pra ignorar; acerto de contas com o passado' },
  { nome: 'O Mundo', sentido: 'ciclo completo; chegar onde se queria e reconhecer' },
] as const;

/**
 * As três posições.
 *
 * Escolhidas pra caber em qualquer pergunta — "passado/presente/futuro"
 * obrigaria a IA a fazer previsão, que é o que o produto evita. Estas falam
 * de situação, não de linha do tempo.
 */
const POSICOES = [
  'o que está posto',
  'o que atravessa',
  'o que se abre',
] as const;

/** A quarta carta, só em dia de ouro. */
const POSICAO_DOURADA = 'o presente do dia';

export const cartas: Espetaculo = {
  id: 'cartas',
  nome: 'As cartas',
  duracaoMs: 14_000,

  executar(ctx: ContextoDoEspetaculo): ResultadoDoEspetaculo {
    const aleatorio = geradorDe(`${ctx.semente}:cartas`);
    const quantas = ctx.diaDeOuro ? 4 : 3;
    const tiradas = sortearSemRepetir(ARCANOS, quantas, aleatorio);

    const simbolos: Simbolo[] = tiradas.map((carta, i) => ({
      nome: carta.nome,
      posicao: i < 3 ? POSICOES[i] : POSICAO_DOURADA,
      sentido: carta.sentido,
      dourado: i === 3,
    }));

    return {
      espetaculo: 'cartas',
      nome: 'As cartas',
      simbolos,
      cena: {
        /**
         * A ordem de virada e o tempo entre uma carta e outra. A animação
         * respeita isso pra que a quarta carta (dourada) chegue depois de uma
         * pausa maior — é a pausa que faz o bônus ser sentido como bônus, e
         * não como "veio mais uma".
         */
        intervaloMs: ctx.diaDeOuro ? 3200 : 4000,
        temDourada: ctx.diaDeOuro,
      },
    };
  },
};
