import type { Cargas, Eixo } from './eixos';

/**
 * Os 26 itens do teste (SPEC 2.3).
 *
 * Composição: 8 itens de Agência, 8 de Comunhão, 5 de Abertura, 5 de
 * Estabilidade. O `eixo` diz qual deles o item foi escrito para discriminar —
 * mas as cargas cruzam eixos de propósito, porque escolha de gente real
 * raramente é pura. O item de Agência que também mexe em Comunhão é o que
 * distingue "decide sozinho" de "decide arrastando todo mundo junto".
 *
 * ── Três regras que valem para cada item escrito daqui pra frente ──────────
 *
 * 1. **Nenhuma opção pode ser a errada.** O SPEC 2.6 chama isso de
 *    desejabilidade social: ninguém marca "sou manipulador". Toda opção é
 *    formulada como estratégia legítima de alguém adulto. Se ao ler as quatro
 *    você consegue apontar "a ruim", o item está quebrado.
 * 2. **Cena, não pergunta sobre si.** "Você se considera assertiva?" mede
 *    autoimagem. "A sala inteira está esperando alguém falar" mede escolha.
 * 3. **Carga em [-1, +1].** Verificado em teste — carga fora da faixa
 *    desequilibra o item contra os outros sem ninguém notar.
 *
 * ── Sobre "metade dos itens invertidos" ───────────────────────────────────
 *
 * O SPEC 2.3 pede 4 diretos / 4 invertidos por eixo, com o antídoto de
 * aquiescência do 2.6 como justificativa. **Isso não transfere para este
 * formato.** Aquiescência é a tendência a concordar com afirmações; aqui não
 * há o que concordar — são quatro cenas de escolha forçada, e marcar "sim para
 * tudo" é impossível por construção.
 *
 * O viés que sobra e é real: **efeito de ordem** (SPEC 2.6). Ele é tratado em
 * dois lugares — a ordem das opções é embaralhada na exibição, e aqui a
 * posição da opção de carga alta é distribuída de propósito entre as quatro
 * posições ao longo do banco (ver o teste `distribuicaoDaPosicaoAlta`), para
 * que quem sempre marca a primeira não acabe com um perfil sistemático.
 */
export interface Opcao {
  texto: string;
  cargas: Cargas;
}

export interface Item {
  id: string;
  /** Eixo que o item foi escrito para discriminar. */
  eixo: Eixo;
  cena: string;
  opcoes: [Opcao, Opcao, Opcao, Opcao];
}

export const ITENS: Item[] = [
  // ─── AGÊNCIA (8) ────────────────────────────────────────────────────────
  {
    id: 'q01',
    eixo: 'agencia',
    cena: 'A roda inteira está esperando alguém dizer a primeira coisa.',
    opcoes: [
      {
        texto: 'Digo. Alguém tem que abrir, e eu não morro por isso.',
        cargas: { agencia: 0.9, comunhao: 0.1 },
      },
      {
        texto: 'Espero mais um pouco. Quase sempre aparece alguém.',
        cargas: { agencia: -0.7, comunhao: 0.1 },
      },
      {
        texto: 'Olho pra quem eu sei que quer falar e abro espaço.',
        cargas: { agencia: 0.3, comunhao: 0.8 },
      },
      {
        texto: 'Guardo o que penso pro fim, quando já sei onde piso.',
        cargas: { agencia: -0.2, comunhao: -0.4, estabilidade: 0.3 },
      },
    ],
  },
  {
    id: 'q02',
    eixo: 'agencia',
    cena: 'Combinaram uma coisa sem te consultar, e te avisaram depois.',
    opcoes: [
      {
        texto: 'Deixo passar essa, e reparo se vira hábito.',
        cargas: { agencia: -0.5, comunhao: 0.2, estabilidade: 0.4 },
      },
      {
        texto: 'Puxo a pessoa em particular, sem plateia.',
        cargas: { agencia: 0.4, comunhao: 0.6 },
      },
      {
        texto: 'Sigo o combinado e da próxima já chego com o meu pronto.',
        cargas: { agencia: 0.5, comunhao: -0.5 },
      },
      {
        texto: 'Falo na hora que não foi assim que combinamos.',
        cargas: { agencia: 0.85, comunhao: -0.2 },
      },
    ],
  },
  {
    id: 'q03',
    eixo: 'agencia',
    cena: 'O plano de todo mundo desandou e ninguém sabe o que fazer.',
    opcoes: [
      {
        texto: 'Cuido do meu pedaço direito. É o que está na minha mão.',
        cargas: { agencia: 0.1, comunhao: -0.6 },
      },
      {
        texto: 'Espero a poeira baixar. Decisão em pânico sai torta.',
        cargas: { agencia: -0.6, comunhao: -0.1, estabilidade: 0.6 },
      },
      {
        texto: 'Assumo. Digo o próximo passo e a gente discute depois.',
        cargas: { agencia: 0.9, comunhao: 0.2 },
      },
      {
        texto: 'Pergunto o que cada um consegue fazer agora.',
        cargas: { agencia: 0.3, comunhao: 0.85 },
      },
    ],
  },
  {
    id: 'q04',
    eixo: 'agencia',
    cena: 'Aparece uma chance boa, mas você teria que se expor pra pegar.',
    opcoes: [
      {
        texto: 'Deixo passar. Vai vir outra que custe menos.',
        cargas: { agencia: -0.75, estabilidade: 0.2 },
      },
      {
        texto: 'Pego. Depois eu descubro como dar conta.',
        cargas: { agencia: 0.9, abertura: 0.5, estabilidade: 0.2 },
      },
      {
        texto: 'Só se eu já estiver pronta. Não gosto de improvisar isso.',
        cargas: { agencia: -0.3, abertura: -0.5 },
      },
      {
        texto: 'Chamo alguém pra ir junto. Sozinha eu não iria.',
        cargas: { agencia: 0.1, comunhao: 0.7 },
      },
    ],
  },
  {
    id: 'q05',
    eixo: 'agencia',
    cena: 'Alguém que você admira diz algo que você acha errado.',
    opcoes: [
      {
        texto: 'Pergunto mais, pra ver se sou eu que não entendi.',
        cargas: { agencia: 0.1, comunhao: 0.5, abertura: 0.5 },
      },
      {
        texto: 'Anoto e trago depois, num momento melhor.',
        cargas: { agencia: 0.3, comunhao: 0.3, estabilidade: 0.4 },
      },
      {
        texto: 'Fico calada. Não é a minha briga.',
        cargas: { agencia: -0.8, comunhao: -0.2 },
      },
      {
        texto: 'Discordo ali mesmo. Admirar não é concordar.',
        cargas: { agencia: 0.85, comunhao: -0.2 },
      },
    ],
  },
  {
    id: 'q06',
    eixo: 'agencia',
    cena: 'Você precisa pedir uma coisa que é sua por direito.',
    opcoes: [
      {
        texto: 'Espero a hora certa, e ela existe.',
        cargas: { agencia: 0.2, comunhao: -0.2, estabilidade: 0.5 },
      },
      {
        texto: 'Adio. Pedir me custa mais do que a coisa vale.',
        cargas: { agencia: -0.85, estabilidade: -0.3 },
      },
      {
        texto: 'Peço direto, sem enfeitar. É meu.',
        cargas: { agencia: 0.9, comunhao: -0.3 },
      },
      {
        texto: 'Peço, mas explico bem os motivos antes.',
        cargas: { agencia: 0.4, comunhao: 0.5 },
      },
    ],
  },
  {
    id: 'q07',
    eixo: 'agencia',
    cena: 'O caminho que você ia seguir fechou, e não tem outro óbvio.',
    opcoes: [
      {
        texto: 'Paro. Caminho fechado às vezes é resposta.',
        cargas: { agencia: -0.7, abertura: 0.3 },
      },
      {
        texto: 'Abro um. Nem que seja torto no começo.',
        cargas: { agencia: 0.9, abertura: 0.6 },
      },
      {
        texto: 'Volto e refaço o trecho até achar onde errei.',
        cargas: { agencia: 0.3, abertura: -0.3, estabilidade: 0.3 },
      },
      {
        texto: 'Pergunto pra quem já passou por aqui.',
        cargas: { agencia: -0.1, comunhao: 0.8 },
      },
    ],
  },
  {
    id: 'q08',
    eixo: 'agencia',
    cena: 'Te oferecem o lugar de quem decide. Vem junto a conta se der errado.',
    opcoes: [
      {
        texto: 'Aceito. Prefiro decidir e errar a obedecer e errar.',
        cargas: { agencia: 0.95, estabilidade: 0.3 },
      },
      {
        texto: 'Aceito se as pessoas certas estiverem comigo.',
        cargas: { agencia: 0.5, comunhao: 0.7 },
      },
      {
        texto: 'Recuso. Trabalho melhor sem esse peso.',
        cargas: { agencia: -0.6, estabilidade: 0.2 },
      },
      {
        texto: 'Aceito por um tempo, pra ver se serve pra mim.',
        cargas: { agencia: 0.35, abertura: 0.5 },
      },
    ],
  },

  // ─── COMUNHÃO (8) ───────────────────────────────────────────────────────
  {
    id: 'q09',
    eixo: 'comunhao',
    cena: 'Alguém começa a chorar do seu lado, e você mal conhece a pessoa.',
    opcoes: [
      {
        texto: 'Dou espaço. Se quiser, ela me procura.',
        cargas: { comunhao: -0.4, agencia: -0.2 },
      },
      {
        texto: 'Resolvo o que causou. Chorar não vai consertar.',
        cargas: { comunhao: -0.3, agencia: 0.7 },
      },
      {
        texto: 'Chego perto. Ninguém devia chorar sozinha.',
        cargas: { comunhao: 0.9, agencia: 0.3 },
      },
      {
        texto: 'Fico por perto em silêncio, sem encostar.',
        cargas: { comunhao: 0.5, agencia: -0.2 },
      },
    ],
  },
  {
    id: 'q10',
    eixo: 'comunhao',
    cena: 'Uma amiga te conta uma coisa feia que ela fez.',
    opcoes: [
      {
        texto: 'Guardo. Mas passo a olhar ela com outros olhos.',
        cargas: { comunhao: -0.7, estabilidade: 0.2 },
      },
      {
        texto: 'Escuto até o fim antes de pensar qualquer coisa.',
        cargas: { comunhao: 0.85, abertura: 0.3 },
      },
      {
        texto: 'Digo o que penso, mesmo que ela não queira ouvir.',
        cargas: { comunhao: 0.1, agencia: 0.8 },
      },
      {
        texto: 'Pergunto o que ela pretende fazer a respeito.',
        cargas: { comunhao: 0.4, agencia: 0.5 },
      },
    ],
  },
  {
    id: 'q11',
    eixo: 'comunhao',
    cena: 'Você descobre que confiou em quem não devia.',
    opcoes: [
      {
        texto: 'Falo com a pessoa. Quero ouvir dela.',
        cargas: { comunhao: 0.6, agencia: 0.7 },
      },
      {
        texto: 'Corto. Não faço cena, mas não volto.',
        cargas: { comunhao: -0.8, agencia: 0.4 },
      },
      {
        texto: 'Continuo, mais atenta. Gente erra.',
        cargas: { comunhao: 0.8, estabilidade: 0.4 },
      },
      {
        texto: 'Me pergunto o que em mim não viu isso antes.',
        cargas: { comunhao: 0.1, estabilidade: -0.5, abertura: 0.4 },
      },
    ],
  },
  {
    id: 'q12',
    eixo: 'comunhao',
    cena: 'Sala cheia de gente que você não conhece.',
    opcoes: [
      {
        texto: 'Procuro a única pessoa que parece tão perdida quanto eu.',
        cargas: { comunhao: 0.6, agencia: 0.1 },
      },
      {
        texto: 'Fico num canto, olhando. Aprendo mais assim.',
        cargas: { comunhao: -0.6, agencia: -0.4, abertura: 0.4 },
      },
      {
        texto: 'Cumpro o que vim fazer e vou embora.',
        cargas: { comunhao: -0.7, agencia: 0.4 },
      },
      {
        texto: 'Puxo conversa com quem estiver mais perto.',
        cargas: { comunhao: 0.85, agencia: 0.6 },
      },
    ],
  },
  {
    id: 'q13',
    eixo: 'comunhao',
    cena: 'Alguém de quem você não gosta pede sua ajuda.',
    opcoes: [
      {
        texto: 'Ajudo se ninguém mais puder.',
        cargas: { comunhao: 0.4, agencia: -0.2 },
      },
      {
        texto: 'Ajudo. Gostar não tem nada a ver com isso.',
        cargas: { comunhao: 0.9, estabilidade: 0.3 },
      },
      {
        texto: 'Ajudo no mínimo, e deixo claro que é o mínimo.',
        cargas: { comunhao: -0.3, agencia: 0.5 },
      },
      {
        texto: 'Digo que não. Seria fingimento.',
        cargas: { comunhao: -0.7, agencia: 0.6 },
      },
    ],
  },
  {
    id: 'q14',
    eixo: 'comunhao',
    cena: 'O trabalho saiu bom, e foi mais seu do que dos outros.',
    opcoes: [
      {
        texto: 'Digo que foi de todo mundo. Foi, no fim.',
        cargas: { comunhao: 0.85, agencia: -0.2 },
      },
      {
        texto: 'Deixo claro qual parte foi minha, sem diminuir ninguém.',
        cargas: { comunhao: 0.2, agencia: 0.8 },
      },
      {
        texto: 'Não falo nada. Quem acompanhou sabe.',
        cargas: { comunhao: -0.2, agencia: -0.5 },
      },
      {
        texto: 'Guardo pra quando precisar que saibam.',
        cargas: { comunhao: -0.6, agencia: 0.5 },
      },
    ],
  },
  {
    id: 'q15',
    eixo: 'comunhao',
    cena: 'Você está mal, de verdade, e alguém pergunta como você está.',
    opcoes: [
      {
        texto: 'Conto um pedaço, pra ver como a pessoa reage.',
        cargas: { comunhao: 0.4, estabilidade: 0.2 },
      },
      {
        texto: 'Digo que estou bem. Resolvo o meu sozinha.',
        cargas: { comunhao: -0.8, agencia: 0.4 },
      },
      {
        texto: 'Mudo de assunto e pergunto dela.',
        cargas: { comunhao: 0.3, agencia: -0.4 },
      },
      {
        texto: 'Conto. Pra que serve gente perto, então?',
        cargas: { comunhao: 0.9, estabilidade: -0.2 },
      },
    ],
  },
  {
    id: 'q16',
    eixo: 'comunhao',
    cena: 'Precisam de alguém pra cuidar de uma coisa chata por um tempo.',
    opcoes: [
      {
        texto: 'Faço se me pedirem. Não me ofereço.',
        cargas: { comunhao: 0.1, agencia: -0.6 },
      },
      {
        texto: 'Passo. Já carreguei a minha cota dessas.',
        cargas: { comunhao: -0.7, agencia: 0.3 },
      },
      {
        texto: 'Me ofereço. Alguém vai ter que ser.',
        cargas: { comunhao: 0.8, agencia: 0.5 },
      },
      {
        texto: 'Proponho dividir entre todo mundo.',
        cargas: { comunhao: 0.6, agencia: 0.7 },
      },
    ],
  },

  // ─── ABERTURA (5) ───────────────────────────────────────────────────────
  {
    id: 'q17',
    eixo: 'abertura',
    cena: 'Um sonho seu volta pela terceira noite seguida.',
    opcoes: [
      {
        texto: 'Acho curioso e comento com alguém.',
        cargas: { abertura: 0.4, comunhao: 0.5 },
      },
      {
        texto: 'Reparo no que ando comendo e dormindo.',
        cargas: { abertura: -0.6, estabilidade: 0.4 },
      },
      {
        texto: 'Nada. Sonho é sonho.',
        cargas: { abertura: -0.85 },
      },
      {
        texto: 'Anoto tudo. Alguma coisa está tentando ser dita.',
        cargas: { abertura: 0.9 },
      },
    ],
  },
  {
    id: 'q18',
    eixo: 'abertura',
    cena: 'Você para diante de uma coisa que não entende, e ela te prende.',
    opcoes: [
      {
        texto: 'Sigo em frente. Não é pra mim.',
        cargas: { abertura: -0.8 },
      },
      {
        texto: 'Fico ali. Não entender é parte da graça.',
        cargas: { abertura: 0.9 },
      },
      {
        texto: 'Procuro saber o que é, e aí volto a olhar.',
        cargas: { abertura: 0.3, agencia: 0.4 },
      },
      {
        texto: 'Invento a minha explicação e fico com ela.',
        cargas: { abertura: 0.6, agencia: 0.4 },
      },
    ],
  },
  {
    id: 'q19',
    eixo: 'abertura',
    cena: 'A semana inteira cabe no mesmo caminho de sempre.',
    opcoes: [
      {
        texto: 'Mantenho o caminho e mudo o que faço dentro dele.',
        cargas: { abertura: 0.4, estabilidade: 0.4 },
      },
      {
        texto: 'Nem reparo. Estou ocupada demais pra isso.',
        cargas: { abertura: -0.4, agencia: 0.4 },
      },
      {
        texto: 'Isso me sufoca. Mudo alguma coisa, qualquer uma.',
        cargas: { abertura: 0.85, estabilidade: -0.3 },
      },
      {
        texto: 'Gosto. É no repetido que eu penso melhor.',
        cargas: { abertura: -0.8, estabilidade: 0.6 },
      },
    ],
  },
  {
    id: 'q20',
    eixo: 'abertura',
    cena: 'Uma pergunta que não tem resposta fica rondando você.',
    opcoes: [
      {
        texto: 'Deixo rondar. Gosto da companhia dela.',
        cargas: { abertura: 0.9, estabilidade: 0.3 },
      },
      {
        texto: 'Cavo até achar alguma resposta, mesmo provisória.',
        cargas: { abertura: 0.4, agencia: 0.7 },
      },
      {
        texto: 'Levo pra alguém que goste de pensar essas coisas.',
        cargas: { abertura: 0.5, comunhao: 0.7 },
      },
      {
        texto: 'Largo. Tem pergunta que só rouba tempo.',
        cargas: { abertura: -0.8, estabilidade: 0.4 },
      },
    ],
  },
  {
    id: 'q21',
    eixo: 'abertura',
    cena: 'Você percebe que estava errada sobre uma coisa importante.',
    opcoes: [
      {
        texto: 'Fico com as duas versões até uma vencer.',
        cargas: { abertura: 0.7, estabilidade: 0.2 },
      },
      {
        texto: 'Custa. Levo tempo pra soltar o que eu já achava.',
        cargas: { abertura: -0.7, estabilidade: -0.2 },
      },
      {
        texto: 'Troco de ideia e falo alto que troquei.',
        cargas: { abertura: 0.8, agencia: 0.7 },
      },
      {
        texto: 'Troco por dentro, sem anunciar.',
        cargas: { abertura: 0.5, comunhao: -0.3 },
      },
    ],
  },

  // ─── ESTABILIDADE (5) ───────────────────────────────────────────────────
  {
    id: 'q22',
    eixo: 'estabilidade',
    cena: 'Você errou, e o erro apareceu para todo mundo.',
    opcoes: [
      {
        texto: 'Assumo, conserto, sigo. Acontece.',
        cargas: { estabilidade: 0.9, agencia: 0.6 },
      },
      {
        texto: 'Conserto, mas fico revirando aquilo por dias.',
        cargas: { estabilidade: -0.7 },
      },
      {
        texto: 'Preciso falar disso com alguém antes de virar a página.',
        cargas: { estabilidade: -0.3, comunhao: 0.7 },
      },
      {
        texto: 'Já estou pensando em como não acontecer de novo.',
        cargas: { estabilidade: 0.5, agencia: 0.5, abertura: -0.3 },
      },
    ],
  },
  {
    id: 'q23',
    eixo: 'estabilidade',
    cena: 'Uma notícia importante chega amanhã, e não dá pra apressar.',
    opcoes: [
      {
        texto: 'Fico perto de gente. Sozinha eu invento coisa.',
        cargas: { estabilidade: -0.4, comunhao: 0.8 },
      },
      {
        texto: 'Ocupo o dia. Esperar parada é que me mata.',
        cargas: { estabilidade: 0.2, agencia: 0.6 },
      },
      {
        texto: 'Não penso em outra coisa até chegar.',
        cargas: { estabilidade: -0.85 },
      },
      {
        texto: 'Já imaginei os dois desfechos e me arrumei pros dois.',
        cargas: { estabilidade: 0.7, abertura: 0.3 },
      },
    ],
  },
  {
    id: 'q24',
    eixo: 'estabilidade',
    cena: 'Alguém te critica na frente dos outros.',
    opcoes: [
      {
        texto: 'Respondo ali. Não engulo em público.',
        cargas: { estabilidade: 0.2, agencia: 0.85 },
      },
      {
        texto: 'Não digo nada, e levo aquilo pra casa comigo.',
        cargas: { estabilidade: -0.8, agencia: -0.5 },
      },
      {
        texto: 'Procuro a pessoa depois pra entender de onde veio.',
        cargas: { estabilidade: 0.4, comunhao: 0.7 },
      },
      {
        texto: 'Escuto, separo o que serve, descarto o resto.',
        cargas: { estabilidade: 0.9 },
      },
    ],
  },
  {
    id: 'q25',
    eixo: 'estabilidade',
    cena: 'Muda tudo de uma vez, e não foi você que escolheu.',
    opcoes: [
      {
        texto: 'Alguma parte de mim gosta do sacode.',
        cargas: { estabilidade: 0.4, abertura: 0.8 },
      },
      {
        texto: 'Me viro. Reclamar não desfaz.',
        cargas: { estabilidade: 0.85, agencia: 0.5 },
      },
      {
        texto: 'Levo um tempo no chão antes de levantar.',
        cargas: { estabilidade: -0.8 },
      },
      {
        texto: 'Junto a minha gente. Assim aguenta.',
        cargas: { estabilidade: 0.1, comunhao: 0.85 },
      },
    ],
  },
  {
    id: 'q26',
    eixo: 'estabilidade',
    cena: 'Três da manhã, você acordada, e o dia seguinte pesando.',
    opcoes: [
      {
        texto: 'É a minha melhor hora, na real.',
        cargas: { estabilidade: 0.5, abertura: 0.7 },
      },
      {
        texto: 'Mando mensagem pra alguém que também está acordado.',
        cargas: { estabilidade: -0.2, comunhao: 0.8 },
      },
      {
        texto: 'Levanto e faço alguma coisa até cansar.',
        cargas: { estabilidade: 0.2, agencia: 0.7 },
      },
      {
        texto: 'Fico deitada, e a cabeça anda sozinha.',
        cargas: { estabilidade: -0.85 },
      },
    ],
  },
];

/** Quantos itens o teste tem. Usado em teste para travar o número. */
export const TOTAL_DE_ITENS = ITENS.length;

/**
 * A 27ª pergunta (SPEC 2.4) — exibida **só** quando dois familiares empatam
 * dentro do limiar angular.
 *
 * Não é mais um item de escala: é uma escolha direta entre os dois arquétipos
 * empatados, em linguagem de cena. O SPEC é explícito sobre a razão — "quem
 * define é a pessoa" — e é isso que resolve pela raiz o incômodo de o signo
 * parecer estar decidindo.
 */
export const CENA_DE_DESEMPATE =
  'Dois pares de olhos te encontraram ao mesmo tempo. Só um pode atravessar.';
