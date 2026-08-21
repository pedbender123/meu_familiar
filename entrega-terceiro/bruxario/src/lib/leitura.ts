import { GoogleGenAI, Type } from '@google/genai';
import type { Familiar } from './familiares';
import type { LuaId } from './familiares';
import type { Signo } from './astro';
import { DOLAR } from './custos';

/**
 * ── Por que voltou para o Gemini ──────────────────────────────────────────
 *
 * O `gpt-5.4` escrevia bem, mas demorava demais. A leitura roda depois do
 * pagamento, com a pessoa parada numa tela de espera olhando o próprio
 * dinheiro já debitado — é o pior lugar do produto para uma chamada lenta.
 * O flash-lite responde numa fração do tempo e, para texto de leitura
 * cerimonial, a diferença de qualidade não paga a diferença de espera.
 */
const MODELO = 'gemini-3.5-flash-lite';

export interface Leitura {
  nome_secreto: string;
  saudacao: string;
  regencia: string;
  /** 3 parágrafos na Revelação, 6 na Completa. */
  leitura: string[];
  frase_de_invocacao: string;
  sussurro_final: string;
  /**
   * Direção de voz pra narração (Completa), gerada junto com o resto do
   * texto — o próprio modelo que escreveu a leitura é quem melhor sabe onde
   * ela pede pausa, sussurro ou firmeza. Vai direto pro parâmetro
   * `instructions` do `gpt-4o-mini-tts`, ver `narracao.ts`.
   */
  instrucoes_narracao: string;
  /**
   * Custo estimado desta chamada, em centavos (ver `custos.ts`). Fica na
   * leitura em vez de num contador global para o painel poder dizer quanto
   * CADA pedido custou, não só o total do mês.
   */
  custoCentavos?: number;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nome_secreto: { type: Type.STRING },
    saudacao: { type: Type.STRING },
    regencia: { type: Type.STRING },
    leitura: { type: Type.ARRAY, items: { type: Type.STRING } },
    frase_de_invocacao: { type: Type.STRING },
    sussurro_final: { type: Type.STRING },
    instrucoes_narracao: { type: Type.STRING },
  },
  required: [
    'nome_secreto',
    'saudacao',
    'regencia',
    'leitura',
    'frase_de_invocacao',
    'sussurro_final',
    'instrucoes_narracao',
  ],
};

export function montarPrompt(params: {
  nome: string;
  familiar: Familiar;
  signoSol: Signo;
  signoLua: Signo;
  lua: LuaId;
  resumoRespostas: string;
  longa: boolean;
  perfil?: string;
}) {
  const { nome, familiar, signoSol, signoLua, lua, resumoRespostas, longa, perfil } = params;
  const paragrafos = longa ? 6 : 3;
  return `Você é a voz do Bruxário, um grimório digital brasileiro. Escreva em português
brasileiro, segunda pessoa, tom de sussurro cerimonial — íntimo, imagético,
caloroso, sem clichês de horóscopo e sem prometer previsões literais.

Dados:
- Nome da pessoa: ${nome}
- Familiar: ${familiar.nome} — arquétipo: ${familiar.arquetipo} — elemento: ${familiar.elemento}
- Signo solar: ${signoSol} · Signo lunar: ${signoLua}
- Fase da lua escolhida: ${lua}
- O que ela escolheu, cena por cena:
${resumoRespostas}
${perfil ? `- O que o teste mediu (use como matéria-prima, NUNCA cite número nem nome de eixo):\n${perfil}` : ''}

Gere APENAS um JSON válido, sem markdown, neste formato:
{
  "nome_secreto": "nome próprio inventado para o familiar, evocativo, 1-2 palavras",
  "saudacao": "1 frase em que o familiar reconhece a pessoa pelo nome",
  "regencia": "1 linha curta unindo familiar e signos, para a arte (ex.: 'Corvo de Sol em Escorpião, Lua em Peixes')",
  "leitura": [${longa
    ? `"parágrafo 1: por que ele a escolheu — cite escolhas ESPECÍFICAS dela",
               "parágrafo 2: a tensão central do perfil dela, o que puxa para dois lados",
               "parágrafo 3: o que o Sol e a Lua revelam através do familiar, sem clichê",
               "parágrafo 4: onde essa combinação costuma custar caro pra ela",
               "parágrafo 5: o que ela faz bem e provavelmente não se dá crédito",
               "parágrafo 6: o que ele veio lembrar — termine com um passo pequeno e concreto"`
    : `"parágrafo 1: por que ele a escolheu (ligar às respostas)",
               "parágrafo 2: o que o Sol e a Lua dela revelam através do familiar — usar os traços reais dos signos, sem clichê",
               "parágrafo 3: o que ele veio lembrar ou despertar"`}],
  "frase_de_invocacao": "1 frase curta, tipo mantra, para a arte",
  "sussurro_final": "1 frase em que o familiar menciona sentir uma pergunta não feita na pessoa (gancho para o Oráculo)",
  "instrucoes_narracao": "direção de voz para um dublador ler ESTA leitura específica em voz alta: onde sussurrar, onde ir mais devagar, onde a voz firma — referenciando o arco emocional do texto que você acabou de escrever, não instrução genérica"
}
Cada parágrafo: ${longa ? '70-110' : '50-80'} palavras, exatamente ${paragrafos} parágrafos.
"instrucoes_narracao": 2-4 frases curtas, em português, escritas para o
parâmetro de estilo de um modelo de texto-pra-fala (não para o leitor final).

REGRAS DURAS:
- Personalize com o nome, os signos e as escolhas dela. Cite escolhas
  específicas — é o que separa leitura de horóscopo.
- Nunca mencione IA, quiz, teste, sistema, eixo, escore ou número.
- Evite frase que sirva para qualquer pessoa. Teste: se o oposto também
  pudesse ser verdade de alguém, reescreva. "Você tem um lado que poucos
  conhecem" é lixo; "você decide rápido e revisa depois" é leitura.
- "instrucoes_narracao" precisa ser direção de VOZ (ritmo, pausa, volume,
  emoção), nunca conteúdo do texto — o dublador já tem o texto, só falta
  saber como lê-lo.`;
}

function limparEValidar(texto: string): Leitura {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const json = JSON.parse(limpo);
  if (
    !json.nome_secreto ||
    !json.saudacao ||
    !json.regencia ||
    !Array.isArray(json.leitura) ||
    json.leitura.length < 3 ||
    !json.frase_de_invocacao ||
    !json.sussurro_final ||
    !json.instrucoes_narracao
  ) {
    throw new Error('JSON da leitura fora do formato esperado');
  }
  return json as Leitura;
}

export async function gerarLeitura(params: {
  nome: string;
  familiar: Familiar;
  signoSol: Signo;
  signoLua: Signo;
  lua: LuaId;
  resumoRespostas: string;
  /** Completa: 6 parágrafos e mais matéria-prima. Revelação: 3. */
  longa?: boolean;
  /** Descrição em PALAVRAS do que o teste mediu — nunca números. */
  perfil?: string;
}): Promise<Leitura> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const ai = new GoogleGenAI({ apiKey });
  const prompt = montarPrompt({ ...params, longa: params.longa ?? false });

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await ai.models.generateContent({
        model: MODELO,
        contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      });
      const texto = resposta.text;
      if (!texto) throw new Error('Resposta vazia do Gemini');
      return {
        ...limparEValidar(texto),
        // O Gemini cobra bem menos que o GPT nesta faixa; o custo por leitura
        // fica em fração de centavo e o painel arredonda para zero.
        custoCentavos: custoDaLeitura(resposta.usageMetadata),
      };
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha ao gerar leitura');
}

/**
 * Custo estimado em centavos de real, pela tabela pública do flash-lite.
 * Ordem de grandeza: menos de meio centavo por leitura.
 */
function custoDaLeitura(uso?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
}): number {
  const entrada = (uso?.promptTokenCount ?? 0) / 1_000_000 * 0.1;
  const saida = (uso?.candidatesTokenCount ?? 0) / 1_000_000 * 0.4;
  return Math.round((entrada + saida) * DOLAR * 100);
}
