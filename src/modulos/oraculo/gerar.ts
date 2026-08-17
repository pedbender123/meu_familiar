import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { modeloDa, custoEstimadoCentavos, type Tarefa } from '../../nucleo/modelos';

/**
 * A chamada ao modelo, com os dois provedores atrás da mesma porta.
 *
 * ── Por que dois ──────────────────────────────────────────────────────────
 *
 * `src/nucleo/modelos.ts` já deixa escolher o modelo por tarefa via variável
 * de ambiente, mas trocar de MODELO é diferente de trocar de PROVEDOR: o SDK
 * é outro, o formato do JSON estruturado é outro, e a contagem de tokens vem
 * em campo diferente. Sem esta camada, "quero testar o modelo da OpenAI no
 * Oráculo e manter o Gemini na leitura da revelação" viraria um `if` no meio
 * da regra de negócio.
 *
 * Aqui o resto do código pede `gerarJson(tarefa, prompt, esquema)` e não
 * sabe quem respondeu.
 */
export interface RespostaDoModelo<T> {
  dados: T;
  modelo: string;
  custoCentavos: number;
  tokensEntrada: number;
  tokensSaida: number;
}

/**
 * O esquema é declarado uma vez em JSON Schema e traduzido para cada
 * provedor — os dois aceitam a mesma forma, com nomes de campo diferentes.
 */
export type EsquemaJson = Record<string, unknown>;

async function viaGoogle<T>(
  modelo: string,
  prompt: string,
  esquema: EsquemaJson
): Promise<Omit<RespostaDoModelo<T>, 'modelo' | 'custoCentavos'>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const ai = new GoogleGenAI({ apiKey });
  const resposta = await ai.models.generateContent({
    model: modelo,
    contents: prompt,
    config: { responseMimeType: 'application/json', responseSchema: esquema },
  });

  const texto = resposta.text;
  if (!texto) throw new Error('resposta vazia do modelo');

  return {
    dados: JSON.parse(texto) as T,
    tokensEntrada: resposta.usageMetadata?.promptTokenCount ?? 0,
    tokensSaida: resposta.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function viaOpenAI<T>(
  modelo: string,
  prompt: string,
  esquema: EsquemaJson
): Promise<Omit<RespostaDoModelo<T>, 'modelo' | 'custoCentavos'>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const cliente = new OpenAI({ apiKey });
  const resposta = await cliente.chat.completions.create({
    model: modelo,
    messages: [{ role: 'user', content: prompt }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'resposta',
        strict: true,
        schema: { ...esquema, additionalProperties: false },
      },
    },
  });

  const texto = resposta.choices[0]?.message?.content;
  if (!texto) throw new Error('resposta vazia do modelo');

  return {
    dados: JSON.parse(texto) as T,
    tokensEntrada: resposta.usage?.prompt_tokens ?? 0,
    tokensSaida: resposta.usage?.completion_tokens ?? 0,
  };
}

/**
 * Gera JSON estruturado para uma tarefa.
 *
 * Uma retentativa, e só uma: o Oráculo responde com a pessoa esperando na
 * tela, e a terceira tentativa custaria mais espera do que vale. Falhou duas
 * vezes, quem chama devolve a cota (ver `nucleo/consumo.ts`).
 */
export async function gerarJson<T>(
  tarefa: Tarefa,
  prompt: string,
  esquema: EsquemaJson
): Promise<RespostaDoModelo<T>> {
  const modelo = modeloDa(tarefa);
  const executar = modelo.provedor === 'openai' ? viaOpenAI<T> : viaGoogle<T>;

  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const bruto = await executar(modelo.id, prompt, esquema);
      return {
        ...bruto,
        modelo: modelo.id,
        custoCentavos: custoEstimadoCentavos(
          modelo,
          bruto.tokensEntrada,
          bruto.tokensSaida
        ),
      };
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error('falha ao falar com o modelo');
}
