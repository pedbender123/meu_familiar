import OpenAI from 'openai';
import type { Leitura } from './leitura';

const MODELO = 'gpt-4o-mini-tts';

/**
 * Uma voz por gênero gramatical do familiar (`familiares.ts`), não por
 * pessoa — é o familiar que fala, não a pessoa que recebeu a leitura.
 *
 * `onyx` e `nova` são as mais consistentemente descritas como grave/masculina
 * e quente/feminina entre as vozes da OpenAI; dá pra trocar aqui sem mexer em
 * mais nada se o teste de ouvido pedir outra.
 */
const VOZES: Record<'m' | 'f', string> = {
  m: 'onyx',
  f: 'nova',
};

/**
 * `gpt-4o-mini-tts` aceita até ~2000 tokens de entrada. A Completa (6
 * parágrafos) fica em torno de 1100-1200 tokens narrada — folga real, mas
 * sem chunking: se os parágrafos crescerem no futuro, isto precisa ser
 * revisto antes de estourar o limite calado.
 */
export async function gerarNarracao(params: {
  texto: string;
  instrucoes: string;
  genero: 'm' | 'f';
}): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const openai = new OpenAI({ apiKey });
  const resposta = await openai.audio.speech.create({
    model: MODELO,
    voice: VOZES[params.genero],
    input: params.texto,
    instructions: params.instrucoes,
    response_format: 'mp3',
  });

  return Buffer.from(await resposta.arrayBuffer());
}

/**
 * Junta os campos da leitura completa num texto corrido pra narrar — a
 * mesma ordem em que a tela de revelação mostra tudo, do reconhecimento até
 * o sussurro final.
 */
export function textoDaLeituraParaNarrar(leitura: Leitura): string {
  return [leitura.saudacao, ...leitura.leitura, leitura.frase_de_invocacao, leitura.sussurro_final]
    .join('\n\n');
}

