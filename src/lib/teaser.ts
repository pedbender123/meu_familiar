import { GoogleGenAI, Type } from '@google/genai';
import type { Familiar } from './familiares';
import { centavosDeTexto } from './custos';

/**
 * O bilhete roda no flash-lite MENOR, e de propósito.
 *
 * A leitura paga usa o `3.5` porque é o produto. Isto aqui é uma frase de
 * bilhete: trabalho pequeno, onde a diferença de qualidade some e a de preço
 * não. E ele é gerado para TODO mundo que termina o funil, pagando ou não —
 * então é o único texto do sistema cujo custo escala com visitante em vez de
 * com cliente. Era exatamente por isso que a narração dele foi desligada.
 */
const MODELO = 'gemini-3.1-flash-lite';

export interface MensagemDoFamiliar {
  /** Uma frase só, curta o bastante para caber num bilhete — nunca cita o animal. */
  frase: string;
  /** Direção de voz pra narração do bilhete, ver `narracao.ts`. */
  instrucoes_narracao: string;
  /** Custo estimado desta chamada, em centavos (ver `custos.ts`). */
  custoCentavos?: number;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    frase: { type: Type.STRING },
    instrucoes_narracao: { type: Type.STRING },
  },
  required: ['frase', 'instrucoes_narracao'],
  additionalProperties: false,
};

/**
 * Usada quando a mensagem não existe ainda ou a pessoa recebeu por cupom
 * grátis sem passar por aqui. Nunca cita arquétipo — é só o gancho, genérico
 * mas honesto, para a tela pós-teste nunca ficar vazia.
 */
export const MENSAGEM_PADRAO: MensagemDoFamiliar = {
  frase: 'Eu li cada escolha sua antes de decidir me aproximar. Não foi acaso — foi reconhecimento.',
  instrucoes_narracao:
    'Sussurrado, íntimo, ritmo lento, uma pausa breve antes da última palavra.',
};

function montarPrompt(params: {
  nome: string;
  familiar: Familiar;
  resumoRespostas: string;
  perfil?: string;
}): string {
  const { nome, familiar, resumoRespostas, perfil } = params;
  return `Você é a voz de um familiar de bruxa (um animal-espírito) do Bruxário, um
grimório digital brasileiro. Alguém acabou de responder um teste e escolheu
você sem saber ainda quem você é. Escreva para fazer essa pessoa querer
descobrir — sem se identificar.

Dados internos (NUNCA aparecem no texto, servem só para escrever pistas com
precisão):
- Nome da pessoa: ${nome}
- O animal que a escolheu: ${familiar.nome} — arquétipo: ${familiar.arquetipo}
- O que ela escolheu, cena por cena:
${resumoRespostas}
${perfil ? `- O que o teste mediu (matéria-prima, NUNCA cite número nem nome de eixo):\n${perfil}` : ''}

Escreva UMA FRASE SÓ, em português brasileiro, segunda pessoa, tom de sussurro
cerimonial — como se você (o familiar) tivesse deixado um bilhete curto para
ela, tendo acabado de observá-la através das respostas. Pense num bilhete de
verdade: cabe numa tira de papel, não numa carta.

REGRAS DURAS:
- UMA frase só, no máximo ~16 palavras (precisa caber em 3 linhas curtas de
  um bilhete pequeno — se estiver longa, corte).
  Nada de "parte 1, parte 2" nem duas ideias emendadas com ponto final — é um
  único fôlego.
- NUNCA use o nome da pessoa (${nome}) na frase — nem no vocativo, nem em
  nenhum outro lugar. Fale só em segunda pessoa ("você"). O nome dela aqui é
  só pra você (o familiar) mirar o tom e inferir gênero — não pra aparecer.
- NUNCA diga o nome do animal (${familiar.nome}) nem dê sinônimo óbvio dele —
  nada de espécie, classe, som que ele faz, parte do corpo típica dele (ex.:
  para um corvo, nunca "ave", "pena", "bico", "grasnar"). A pessoa PRECISA
  terminar de ler sem saber qual bicho é.
- Cite UM traço de personalidade bem específico dela (baseado nas escolhas),
  do jeito que só quem observou de verdade escreveria — nada de frase que
  sirva para qualquer pessoa.
- Gênero gramatical: NÃO flexione adjetivo/particípio (nada de "cansado" /
  "cansada", "certo" / "certa") a menos que "${nome}" seja um primeiro nome
  brasileiro claramente e quase sempre associado a um único gênero. Na
  dúvida, reescreva a frase para não precisar flexionar (troque adjetivo
  predicativo por verbo — em vez de "você anda cansado", "isso tem pesado em
  você").
- Feche com um resquício de mistério sobre quem ele é — sem nunca dizer
  "compre", "pague" ou qualquer palavra de venda.
- Nunca mencione IA, teste, quiz, sistema, eixo ou número.
- Não coloque aspas dentro do texto — a tela já mostra a frase entre aspas.
- "instrucoes_narracao": 1-2 frases curtas, em português, de direção de VOZ
  pra um modelo de texto-pra-fala ler esta frase específica (ritmo, pausa,
  tom) — nunca conteúdo, o dublador já tem o texto.

Gere APENAS um JSON válido, sem markdown, neste formato:
{ "frase": "a frase única, sem aspas dentro dela", "instrucoes_narracao": "..." }`;
}

function limparEValidar(texto: string): MensagemDoFamiliar {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  const json = JSON.parse(limpo);
  if (
    typeof json.frase !== 'string' ||
    !json.frase.trim() ||
    typeof json.instrucoes_narracao !== 'string' ||
    !json.instrucoes_narracao.trim()
  ) {
    throw new Error('JSON da mensagem fora do formato esperado');
  }
  return {
    frase: json.frase.trim().replace(/^["“]|["”]$/g, ''),
    instrucoes_narracao: json.instrucoes_narracao.trim(),
  };
}

/**
 * A mensagem que a pessoa recebe de graça na tela pós-teste, no lugar da
 * carta e do nome do familiar.
 *
 * Diferente de `gerarLeitura` (que só existe depois do pagamento), esta roda
 * ANTES — é o que sustenta a venda. Por isso é deliberadamente curta e mais
 * barata (menos tokens de saída), e por isso a regra mais dura do prompt é
 * "nunca diga qual bicho é": o objetivo não é satisfazer, é intrigar.
 */
export async function gerarMensagemDoFamiliar(params: {
  nome: string;
  familiar: Familiar;
  resumoRespostas: string;
  perfil?: string;
}): Promise<MensagemDoFamiliar> {
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
        config: { responseMimeType: 'application/json', responseSchema: SCHEMA },
      });
      const texto = resposta.text;
      if (!texto) throw new Error('Resposta vazia do Gemini');
      return {
        ...limparEValidar(texto),
        custoCentavos: centavosDeTexto({
          modelo: MODELO,
          tokensEntrada: resposta.usageMetadata?.promptTokenCount ?? 0,
          tokensSaida: resposta.usageMetadata?.candidatesTokenCount ?? 0,
        }),
      };
    } catch (erro) {
      ultimoErro = erro;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error('Falha ao gerar mensagem do familiar');
}
