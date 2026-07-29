import { GoogleGenAI, Type } from '@google/genai';
import type { Familiar } from './familiares';
import type { LuaId } from './familiares';
import type { Signo } from './astro';

const MODELO = 'gemini-3.1-flash-lite';

export interface Leitura {
  nome_secreto: string;
  saudacao: string;
  regencia: string;
  leitura: [string, string, string];
  frase_de_invocacao: string;
  sussurro_final: string;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    nome_secreto: { type: Type.STRING },
    saudacao: { type: Type.STRING },
    regencia: { type: Type.STRING },
    leitura: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    frase_de_invocacao: { type: Type.STRING },
    sussurro_final: { type: Type.STRING },
  },
  required: [
    'nome_secreto',
    'saudacao',
    'regencia',
    'leitura',
    'frase_de_invocacao',
    'sussurro_final',
  ],
};

function montarPrompt(params: {
  nome: string;
  familiar: Familiar;
  signoSol: Signo;
  signoLua: Signo;
  lua: LuaId;
  resumoRespostas: string;
}) {
  const { nome, familiar, signoSol, signoLua, lua, resumoRespostas } = params;
  return `Você é a voz do Bruxário, um grimório digital brasileiro. Escreva em português
brasileiro, segunda pessoa, tom de sussurro cerimonial — íntimo, imagético,
caloroso, sem clichês de horóscopo e sem prometer previsões literais.

Dados:
- Nome da pessoa: ${nome}
- Familiar: ${familiar.nome} — arquétipo: ${familiar.arquetipo} — elemento: ${familiar.elemento}
- Signo solar: ${signoSol} · Signo lunar: ${signoLua}
- Fase da lua escolhida: ${lua}
- Respostas marcantes do ritual: ${resumoRespostas}

Gere APENAS um JSON válido, sem markdown, neste formato:
{
  "nome_secreto": "nome próprio inventado para o familiar, evocativo, 1-2 palavras",
  "saudacao": "1 frase em que o familiar reconhece a pessoa pelo nome",
  "regencia": "1 linha curta unindo familiar e signos, para a arte (ex.: 'Corvo de Sol em Escorpião, Lua em Peixes')",
  "leitura": ["parágrafo 1: por que ele a escolheu (ligar às respostas)",
               "parágrafo 2: o que o Sol e a Lua dela revelam através do familiar — usar os traços reais dos signos, sem clichê",
               "parágrafo 3: o que ele veio lembrar ou despertar"],
  "frase_de_invocacao": "1 frase curta, tipo mantra, para a arte",
  "sussurro_final": "1 frase em que o familiar menciona sentir uma pergunta não feita na pessoa (gancho para o Oráculo)"
}
Cada parágrafo: 50-80 palavras. Personalize com o nome, os signos e as
respostas. Nunca mencione IA, quiz ou sistema.`;
}

function limparEValidar(texto: string): Leitura {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const json = JSON.parse(limpo);
  if (
    !json.nome_secreto ||
    !json.saudacao ||
    !json.regencia ||
    !Array.isArray(json.leitura) ||
    json.leitura.length !== 3 ||
    !json.frase_de_invocacao ||
    !json.sussurro_final
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
}): Promise<Leitura> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const ai = new GoogleGenAI({ apiKey });
  const prompt = montarPrompt(params);

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const resposta = await ai.models.generateContent({
        model: MODELO,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      });
      const texto = resposta.text;
      if (!texto) throw new Error('Resposta vazia do Gemini');
      return limparEValidar(texto);
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha ao gerar leitura');
}
