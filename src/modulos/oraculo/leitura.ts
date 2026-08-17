import { gerarJson } from './gerar';
import type { ResultadoDoEspetaculo } from './espetaculos';
import { NOME_DO_DOMINIO, type PontuacaoDoDia } from '../calendario/pontuacao';

/**
 * A leitura — o texto longo que fecha o ritual.
 *
 * ── A resposta é estruturada POR SÍMBOLO, e isso não é detalhe de formato ──
 *
 * Se o retorno fosse um texto corrido com a instrução "cite as cartas", o
 * modelo citaria de raspão ou esqueceria — e o ritual inteiro viraria
 * enfeite, que é exatamente o que este desenho evita. Com um campo por
 * símbolo, a citação é **impossível de faltar**: se o campo existe, foi
 * preenchido.
 *
 * De quebra a tela fica trivial de montar — cada símbolo aparece ao lado da
 * animação dele.
 */
export interface LeituraDoOraculo {
  abertura: string;
  simbolos: { simbolo: string; oQueDiz: string }[];
  conselho: string;
  fechamento: string;
}

const ESQUEMA = {
  type: 'object',
  properties: {
    abertura: { type: 'string' },
    simbolos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          simbolo: { type: 'string' },
          oQueDiz: { type: 'string' },
        },
        required: ['simbolo', 'oQueDiz'],
      },
    },
    conselho: { type: 'string' },
    fechamento: { type: 'string' },
  },
  required: ['abertura', 'simbolos', 'conselho', 'fechamento'],
};

export interface ContextoDaLeitura {
  nomeDoFamiliar: string;
  pergunta: string;
  espetaculos: ResultadoDoEspetaculo[];
  pontuacaoDoDia: PontuacaoDoDia | null;
  diaDeOuro: boolean;
  /** O retrato em palavras, do teste — nunca números. */
  perfil?: string;
  /** Leituras anteriores, em resumo. É o que faz ele parecer que lembra. */
  historico?: string[];
}

function descreverEspetaculos(espetaculos: ResultadoDoEspetaculo[]): string {
  return espetaculos
    .map((e) => {
      const simbolos = e.simbolos
        .map(
          (s) =>
            `  - ${s.nome} (${s.posicao}): ${s.sentido}${s.dourado ? ' [SÍMBOLO DOURADO — só aparece em dia de ouro]' : ''}`
        )
        .join('\n');
      return `${e.nome}:\n${simbolos}`;
    })
    .join('\n\n');
}

function descreverDia(pontuacao: PontuacaoDoDia | null): string {
  if (!pontuacao) return 'Não há leitura do dia disponível.';
  return Object.entries(pontuacao)
    .map(([dominio, nota]) => `${NOME_DO_DOMINIO[dominio as keyof typeof NOME_DO_DOMINIO]}: ${nota}/100`)
    .join(' · ');
}

/**
 * O prompt.
 *
 * As regras nele não são estilo — são as mesmas do resto do produto, e cada
 * uma existe porque a alternativa custa credibilidade:
 *
 *  - **Convite, nunca previsão.** "Bom dia para pedir" a pessoa aceita ou
 *    não; "você vai conseguir" é afirmação que, quando falha, leva junto a
 *    confiança em todo o resto.
 *  - **Nada de número.** O modelo recebe notas de 0 a 100 como matéria-prima,
 *    mas citá-las transformaria um oráculo em relatório.
 *  - **Todo símbolo entra.** Um símbolo sem parágrafo é um pedaço do ritual
 *    que a pessoa viu acontecer e o texto ignorou.
 */
function montarPrompt(ctx: ContextoDaLeitura): string {
  return `Você é ${ctx.nomeDoFamiliar}, o familiar espiritual desta pessoa. Você fala
com ela em segunda pessoa, em português brasileiro, com intimidade e calma —
como quem conhece ela há tempo e não precisa impressionar.

A PERGUNTA DELA:
"${ctx.pergunta}"

O QUE O RITUAL REVELOU:
${descreverEspetaculos(ctx.espetaculos)}

O CÉU DELA HOJE (matéria-prima — NUNCA cite números):
${descreverDia(ctx.pontuacaoDoDia)}
${ctx.diaDeOuro ? '\nHOJE É UM DIA DE OURO: as quatro portas estão abertas ao mesmo tempo, o que é raro. Isso deve transparecer no tom.' : ''}
${ctx.perfil ? `\nO QUE VOCÊ SABE DELA:\n${ctx.perfil}` : ''}
${ctx.historico?.length ? `\nO QUE ELA JÁ TE CONTOU ANTES:\n${ctx.historico.map((h) => `- ${h}`).join('\n')}` : ''}

COMO RESPONDER:
- "abertura": 2 a 3 frases situando o momento dela. Nunca comece com "Ah," nem
  com saudação genérica.
- "simbolos": UM item para CADA símbolo listado acima, na mesma ordem, com o
  campo "simbolo" exatamente igual ao nome dado. Em "oQueDiz", 3 a 5 frases
  ligando aquele símbolo específico à pergunta dela. É aqui que mora a leitura
  — não resuma.
- "conselho": 3 a 4 frases dizendo o que fazer. Concreto e possível esta
  semana. Uma coisa, não uma lista.
- "fechamento": 1 ou 2 frases. Curto, quente, sem despedida formal.

REGRAS:
- Convite, nunca previsão. "Vale tentar", "é um bom momento para" — jamais
  "você vai" ou "vai acontecer".
- Nunca cite números, notas ou porcentagens.
- Nunca diga que sorteou, calculou ou consultou sistema algum. Os símbolos
  apareceram; você os lê.
- Dia difícil é convite ao recolhimento, nunca ameaça.
- Não invente fatos sobre a vida dela que não estejam acima.
- Sem markdown, sem asteriscos, sem títulos.`;
}

/**
 * Confere que todo símbolo do ritual foi citado.
 *
 * O esquema garante que o campo existe, mas não que o modelo cobriu todos —
 * ele pode devolver dois itens quando havia quatro símbolos. Como a tela
 * mostra cada símbolo ao lado da animação dele, faltar um deixaria um buraco
 * visível bem no meio do produto.
 *
 * Completa em vez de falhar: melhor um símbolo com texto curto do que a
 * leitura inteira perdida — a pessoa já gastou a cota e já viu o ritual.
 */
export function garantirTodosOsSimbolos(
  leitura: LeituraDoOraculo,
  espetaculos: ResultadoDoEspetaculo[]
): LeituraDoOraculo {
  const esperados = espetaculos.flatMap((e) => e.simbolos);
  const porNome = new Map(leitura.simbolos.map((s) => [s.simbolo.toLowerCase(), s]));

  return {
    ...leitura,
    simbolos: esperados.map((esperado) => {
      const achado = porNome.get(esperado.nome.toLowerCase());
      return {
        simbolo: esperado.nome,
        oQueDiz: achado?.oQueDiz ?? esperado.sentido,
      };
    }),
  };
}

export async function gerarLeitura(ctx: ContextoDaLeitura) {
  const resposta = await gerarJson<LeituraDoOraculo>(
    'leitura',
    montarPrompt(ctx),
    ESQUEMA
  );

  return {
    ...resposta,
    dados: garantirTodosOsSimbolos(resposta.dados, ctx.espetaculos),
  };
}
