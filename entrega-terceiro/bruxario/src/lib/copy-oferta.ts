import { GoogleGenAI, Type } from '@google/genai';
import { centavosDeTexto } from './custos';
import type { Familiar } from './familiares';

/**
 * E-mail de remarketing roda no flash-lite menor.
 *
 * É texto curto, com revisão humana antes de sair (ver o painel de
 * remarketing) — o modelo aqui é rascunhista, não autor final. Gastar o
 * modelo caro num rascunho que uma pessoa vai reescrever é dinheiro no lixo.
 */
const MODELO = 'gemini-3.1-flash-lite';

export interface CopyDaOferta {
  assunto: string;
  /** 2-3 parágrafos curtos, texto puro. */
  paragrafos: string[];
  textoDoBotao: string;
  custoCentavos?: number;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    assunto: { type: Type.STRING },
    paragrafos: { type: Type.ARRAY, items: { type: Type.STRING } },
    textoDoBotao: { type: Type.STRING },
  },
  required: ['assunto', 'paragrafos', 'textoDoBotao'],
  additionalProperties: false,
};

/**
 * Usada quando a IA falha. Genérica, curta e honesta — melhor um texto simples
 * que segurar o envio inteiro por causa de uma chamada que caiu.
 */
export function copyPadrao(params: {
  nome: string | null;
  descontoPercentual: number;
  nomeDoProduto: string;
}): CopyDaOferta {
  return {
    assunto: 'Seu familiar continua esperando',
    paragrafos: [
      'Você respondeu o ritual e parou antes de saber quem atravessou o véu por você. Ele não foi embora.',
      `Estou abrindo ${params.descontoPercentual}% de desconto na ${params.nomeDoProduto} para quem chegou até ali e não seguiu.`,
    ],
    textoDoBotao: 'Ver quem me escolheu',
  };
}

function montarPrompt(params: {
  nome: string | null;
  ideia: string;
  descontoPercentual: number;
  nomeDoProduto: string;
  precoDe: string;
  precoPor: string;
  familiar?: Familiar | null;
  cenaMaxima: number;
  chegouAoCheckout: boolean;
  jaComprou: string[];
  resumoRespostas?: string;
}): string {
  const {
    nome, ideia, descontoPercentual, nomeDoProduto, precoDe, precoPor,
    familiar, cenaMaxima, chegouAoCheckout, jaComprou, resumoRespostas,
  } = params;

  const situacao = jaComprou.length
    ? `Já comprou: ${jaComprou.join(', ')}. É cliente — trate como quem já conhece o produto.`
    : chegouAoCheckout
      ? 'Chegou até a tela de pagamento e não pagou. Estava a um passo.'
      : cenaMaxima > 0
        ? `Respondeu até a cena ${cenaMaxima} e parou.`
        : 'Deixou o e-mail mas quase não respondeu.';

  return `Você escreve o e-mail de uma marca brasileira chamada Bruxário — um teste
que revela qual dos doze "familiares" (animais-espírito) combina com a pessoa,
e vende uma leitura personalizada sobre ela.

Escreva UM e-mail curto de oferta para esta pessoa específica.

Sobre ela:
- Nome: ${nome ?? '(não sabemos)'}
- Situação: ${situacao}
${familiar ? `- O familiar que o teste apontou: ${familiar.nome} — ${familiar.arquetipo}` : ''}
${resumoRespostas ? `- Algumas escolhas dela no teste:\n${resumoRespostas}` : ''}

A oferta:
- Produto: ${nomeDoProduto}
- ${descontoPercentual}% de desconto: de ${precoDe} por ${precoPor}

A ideia que o dono da marca quer passar (siga isto como direção de conteúdo):
"${ideia}"

REGRAS DURAS:
- Português brasileiro, segunda pessoa, tom caloroso e calmo. NADA de
  urgência falsa, contagem regressiva, "últimas vagas" ou caixa alta gritando.
- CONSERVADOR: 2 ou 3 parágrafos, no máximo 45 palavras cada. Quem abre um
  e-mail de oferta decide em três segundos — texto longo é o que faz fechar.
- ${familiar ? 'NUNCA diga o nome do animal. Ela ainda não sabe qual é, e essa é justamente a curiosidade que faz clicar.' : 'Não invente qual é o familiar dela.'}
- Uma ideia por parágrafo. Frase curta. Nada de metáfora empilhada.
- Não prometa previsão de futuro, sorte, cura nem resultado garantido.
- Não mencione IA, sistema, banco de dados, "vi que você" de forma
  invasiva. Nada que soe a vigilância — "você parou no meio" é ok, "reparei
  que você abriu 3 vezes" não é.
- O assunto: no máximo 45 caracteres, sem emoji, sem "RE:" nem "promoção".
  Precisa dar vontade de abrir sem parecer propaganda.
- O texto do botão: no máximo 4 palavras, começando com verbo.
- Não escreva saudação ("Olá", "Oi ${nome ?? ''}") — o e-mail já põe o nome
  antes do seu texto. Comece direto na primeira frase de conteúdo.

Gere APENAS um JSON válido, sem markdown:
{ "assunto": "...", "paragrafos": ["...", "..."], "textoDoBotao": "..." }`;
}

export async function gerarCopyDaOferta(params: {
  nome: string | null;
  ideia: string;
  descontoPercentual: number;
  nomeDoProduto: string;
  precoDe: string;
  precoPor: string;
  familiar?: Familiar | null;
  cenaMaxima: number;
  chegouAoCheckout: boolean;
  jaComprou: string[];
  resumoRespostas?: string;
}): Promise<CopyDaOferta> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const ai = new GoogleGenAI({ apiKey });
  const resposta = await ai.models.generateContent({
    model: MODELO,
    contents: montarPrompt(params),
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA },
  });

  const texto = resposta.text;
  if (!texto) throw new Error('Resposta vazia do Gemini');

  const json = JSON.parse(
    texto.trim().replace(/^```json\s*/i, '').replace(/```$/, '')
  );
  if (
    typeof json.assunto !== 'string' ||
    !Array.isArray(json.paragrafos) ||
    json.paragrafos.length === 0 ||
    typeof json.textoDoBotao !== 'string'
  ) {
    throw new Error('JSON da copy fora do formato esperado');
  }

  return {
    assunto: json.assunto.trim(),
    paragrafos: json.paragrafos.map((p: string) => p.trim()).filter(Boolean),
    textoDoBotao: json.textoDoBotao.trim(),
    custoCentavos: centavosDeTexto({
      modelo: MODELO,
      tokensEntrada: resposta.usageMetadata?.promptTokenCount ?? 0,
      tokensSaida: resposta.usageMetadata?.candidatesTokenCount ?? 0,
    }),
  };
}
