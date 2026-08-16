import { GoogleGenAI, Type } from '@google/genai';
import type { Signo } from '../astro';

/**
 * Geração da leitura do Horóscopo — mesmo padrão de `lib/leitura.ts`
 * (Gemini, `responseSchema` estruturado), mas conteúdo e prompt próprios:
 * aqui não existe familiar nem arquétipo, só Sol e Lua.
 */
const MODELO = 'gemini-3.5-flash-lite';

export interface LeituraHoroscopo {
  titulo: string;
  paragrafos: string[];
  frase_final: string;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    titulo: { type: Type.STRING },
    paragrafos: { type: Type.ARRAY, items: { type: Type.STRING } },
    frase_final: { type: Type.STRING },
  },
  required: ['titulo', 'paragrafos', 'frase_final'],
};

function montarPrompt(nome: string, signoSol: Signo, signoLua: Signo): string {
  return `Você escreve horóscopos pessoais em português brasileiro, tom caloroso e
direto, sem clichê de jornal de banca e sem promessa de previsão literal.

Dados:
- Nome da pessoa: ${nome}
- Signo solar: ${signoSol}
- Signo lunar: ${signoLua}

Gere APENAS um JSON válido, sem markdown, neste formato:
{
  "titulo": "título curto, 4-7 palavras, mencionando os dois signos",
  "paragrafos": [
    "parágrafo 1: quem ${nome} é através do Sol em ${signoSol} — traço real do signo, nada genérico",
    "parágrafo 2: o que a Lua em ${signoLua} revela do mundo emocional dela, e como conversa (ou tensiona) com o Sol",
    "parágrafo 3: o que essa combinação pede dela agora — termine com algo concreto, não vago"
  ],
  "frase_final": "1 frase curta, tipo mantra, para fechar a leitura"
}
Cada parágrafo: 60-90 palavras.

REGRAS DURAS:
- Cite o nome da pessoa pelo menos uma vez.
- Use traços REAIS de ${signoSol} e ${signoLua} — nunca frase que sirva para
  qualquer signo. Teste: se o oposto também pudesse ser verdade de outro
  signo, reescreva.
- Nunca mencione IA, algoritmo, sistema ou dado calculado.`;
}

function limparEValidar(texto: string): LeituraHoroscopo {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const json = JSON.parse(limpo);
  if (
    !json.titulo ||
    !Array.isArray(json.paragrafos) ||
    json.paragrafos.length < 3 ||
    !json.frase_final
  ) {
    throw new Error('JSON do horóscopo fora do formato esperado');
  }
  return json as LeituraHoroscopo;
}

const FALLBACK: LeituraHoroscopo = {
  titulo: 'O que o Sol e a Lua dizem de você',
  paragrafos: [
    'Seu Sol marca o jeito como você aparece no mundo — o que os outros notam primeiro e o que te move a agir. É a sua energia mais visível, aquela que não se esconde nem quando você tenta.',
    'Sua Lua guarda o lado que só quem chega perto conhece: como você processa o que sente, o que te acalma e o que te desestabiliza por dentro, longe dos olhos de fora.',
    'A conversa entre os dois é o que faz você ser você — nem só a superfície, nem só o que fica escondido. Prestar atenção em onde eles concordam, e onde puxam para lados diferentes, é o começo de se entender melhor.',
  ],
  frase_final: 'Você já carrega as duas respostas. Só precisa parar para ouvir as duas.',
};

export async function gerarHoroscopo(
  nome: string,
  signoSol: Signo,
  signoLua: Signo
): Promise<LeituraHoroscopo> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return FALLBACK;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = montarPrompt(nome, signoSol, signoLua);

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
      return limparEValidar(texto);
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  console.error('[horoscopo/leitura] falha ao gerar, usando fallback:', ultimoErro);
  return FALLBACK;
}
