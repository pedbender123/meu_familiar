import type { Dominio } from './pontuacao';
import type { Classe } from './pontuacao';

/**
 * O banco de frases do Calendário.
 *
 * ── Por que texto de tabela, e não gerado ─────────────────────────────────
 *
 * A tentação óbvia é mandar o dia para um modelo e pedir uma frase. Um plano
 * anual tem 365 dias × 4 domínios: seria a coisa mais cara do produto, para
 * entregar exatamente o que uma tabela entrega — porque o que dá sentido à
 * frase não é a redação dela, é **qual dia ela caiu**. O cálculo é o produto;
 * a frase é a legenda.
 *
 * ── Como elas são escritas ────────────────────────────────────────────────
 *
 * Três regras, e todas servem a não prometer o que não se pode cumprir:
 *
 *  1. **Convite, nunca previsão.** "Bom dia para pedir" é uma sugestão que a
 *     pessoa aceita ou não; "hoje você vai conseguir" é uma afirmação que,
 *     quando falha, leva junto a credibilidade do resto do produto.
 *  2. **Sobre disposição, não sobre evento.** O trânsito diz como a pessoa
 *     tende a reagir, não o que o mundo vai fazer com ela.
 *  3. **Dia ruim nunca é ameaça.** É recolhimento, é adiar — nunca "cuidado,
 *     algo vai dar errado".
 *
 * Várias por combinação, escolhidas por sorteio determinístico (ver
 * `fraseDoDia`): a mesma data devolve sempre a mesma frase, senão a pessoa
 * abre o calendário duas vezes e vê o dia mudar de recado.
 */
const FRASES: Record<Dominio, Record<Classe, string[]>> = {
  amor: {
    ouro: [
      'Dia de dizer o que você vem engolindo há semanas.',
      'A palavra sai mais fácil hoje. Use isso.',
      'Bom dia para chegar perto de quem você anda evitando por orgulho.',
    ],
    bom: [
      'O afeto circula sem esforço hoje.',
      'Dia bom para uma conversa que estava pendente.',
      'As pessoas te leem com mais generosidade agora.',
    ],
    neutro: [
      'Nada empurra, nada atrapalha. O de sempre.',
      'Dia morno no amor — o que existir hoje é o que você construiu antes.',
    ],
    recolher: [
      'Hoje o afeto vem atravessado. Não decida nada sobre alguém.',
      'Dia de não mandar aquela mensagem. Guarde para depois de amanhã.',
      'A leitura que você faz das pessoas hoje está torta. Espere.',
    ],
  },
  carreira: {
    ouro: [
      'Dia de pedir. Aumento, prazo, oportunidade — o que for.',
      'Sua autoridade está visível hoje. Ocupe o espaço.',
      'Bom dia para mostrar trabalho, não para começar trabalho.',
    ],
    bom: [
      'O esforço rende mais que o normal hoje.',
      'Dia bom para destravar o que estava parado.',
      'Você consegue ser ouvida com menos esforço agora.',
    ],
    neutro: [
      'Dia comum de trabalho. Toque o que já está andando.',
      'Sem vento a favor nem contra — dia de manutenção.',
    ],
    recolher: [
      'Não assine nada hoje. Nem prometa prazo.',
      'Dia de fazer, não de negociar.',
      'A paciência está curta e a leitura da sala, ruim. Adie a conversa difícil.',
    ],
  },
  viagens: {
    ouro: [
      'Dia de comprar a passagem. Sério.',
      'O caminho se abre hoje — decida o destino.',
      'Bom dia para dizer sim ao convite que te tira do lugar.',
    ],
    bom: [
      'Movimento favorecido. Saia da rotina, mesmo que pouco.',
      'Dia bom para planejar o que vem pela frente.',
      'Deslocamento rende hoje, mesmo o pequeno.',
    ],
    neutro: [
      'Dia parado. Nem parta, nem cancele.',
      'O céu não pede estrada hoje.',
    ],
    recolher: [
      'Confirme tudo duas vezes se precisar sair. Hoje escapa detalhe.',
      'Dia de adiar a decisão sobre ir ou ficar.',
    ],
  },
  fortuna: {
    ouro: [
      'Dia de sorte real. O que você pedir hoje tende a vir.',
      'A porta está aberta — atravesse antes que feche.',
      'Bom dia para arriscar o que você vinha adiando por medo.',
    ],
    bom: [
      'As coisas caem no lugar com menos briga hoje.',
      'Dia bom para resolver dinheiro parado.',
      'Pequenas sortes se acumulam — repare nelas.',
    ],
    neutro: [
      'Dia neutro. O que vier, veio do que você já fez.',
      'Sem sorte nem azar: só consequência.',
    ],
    recolher: [
      'Não aposte, não empreste, não compre por impulso.',
      'Dia de guardar. O que sair hoje sai difícil de voltar.',
    ],
  },
};

/** Quando o dia é bom em TUDO — a frase é sobre o dia, não sobre um assunto. */
const DIAS_DE_OURO = [
  'Dia raro. Tudo pede movimento ao mesmo tempo — não desperdice em tarefa pequena.',
  'O céu inteiro está do seu lado hoje. Faça a coisa grande.',
  'Se existe um dia do mês para arriscar, é este.',
];

/** Quando tudo está baixo. Recolhimento, não catástrofe. */
const DIAS_FECHADOS = [
  'Dia de fazer o mínimo e não decidir nada. Amanhã o céu abre.',
  'Nada flui hoje, e tudo bem — é um dia para atravessar, não para aproveitar.',
];

/**
 * Sorteio **determinístico** a partir da data.
 *
 * Sem isto, a mesma data mostraria frases diferentes a cada visita, e o
 * calendário deixaria de parecer uma leitura para parecer um gerador de
 * biscoito da sorte. A soma dos caracteres basta: não precisa ser um hash
 * bom, precisa ser estável.
 */
function escolher(opcoes: string[], semente: string): string {
  let soma = 0;
  for (let i = 0; i < semente.length; i++) soma += semente.charCodeAt(i);
  return opcoes[soma % opcoes.length];
}

export function fraseDoDia(
  data: string,
  dominio: Dominio,
  classe: Classe,
  todosAltos: boolean,
  todosBaixos: boolean
): string {
  if (todosAltos) return escolher(DIAS_DE_OURO, data);
  if (todosBaixos) return escolher(DIAS_FECHADOS, data);
  return escolher(FRASES[dominio][classe], `${data}${dominio}`);
}

/** A frase por domínio, para o detalhe do dia mostrar os quatro. */
export function fraseDoDominio(data: string, dominio: Dominio, classe: Classe): string {
  return escolher(FRASES[dominio][classe], `${data}${dominio}`);
}

/* ── Períodos ──────────────────────────────────────────────────────────── */

const PERIODO: Record<'semana' | 'mes', Record<Classe, string[]>> = {
  semana: {
    ouro: [
      'Semana de sorte. Concentre nela o que você vem adiando.',
      'Sete dias bons seguidos são raros — aproveite com intenção.',
    ],
    bom: [
      'Semana favorável. O esforço rende.',
      'Boa semana para tocar projeto que já estava em pé.',
    ],
    neutro: [
      'Semana comum. Constância vale mais que impulso.',
      'Nada se destaca — semana de manter o que já anda.',
    ],
    recolher: [
      'Semana pesada. Reduza o que der para reduzir.',
      'Semana de atravessar, não de começar.',
    ],
  },
  mes: {
    ouro: [
      'Mês raro. Se havia uma virada para dar, é agora.',
      'Mês em que o céu abre — planeje o grande, não o urgente.',
    ],
    bom: [
      'Bom mês. As coisas andam com menos atrito.',
      'Mês favorável para consolidar o que você começou.',
    ],
    neutro: [
      'Mês de rotina. O que render, rende pelo seu trabalho.',
      'Mês sem grandes marés — bom para construir devagar.',
    ],
    recolher: [
      'Mês de recolhimento. Guarde energia e dinheiro.',
      'Mês difícil de forçar. Deixe maturar o que não está pronto.',
    ],
  },
};

export function frasePeriodo(
  tipo: 'semana' | 'mes',
  classe: Classe,
  semente: string
): string {
  return escolher(PERIODO[tipo][classe], semente);
}
