/**
 * Quanto cada chamada de IA custou, em centavos de real.
 *
 * ── Por que estimativa e não fatura ───────────────────────────────────────
 *
 * Nem o Gemini nem a OpenAI devolvem preço na resposta — devolvem tokens. O
 * preço por token está na tabela pública de cada um, e a conversão para real
 * depende do câmbio do dia. Então este arquivo é a melhor estimativa possível no momento da
 * chamada, e é assim que o painel deve apresentar: "custo estimado de IA",
 * nunca "valor faturado".
 *
 * O número que NÃO é estimativa é a taxa do Mercado Pago — aquela vem lida da
 * resposta dele, por venda, e está em `pagamento.ts`.
 *
 * ── Onde mexer quando o preço mudar ───────────────────────────────────────
 *
 * Só aqui. Nenhum outro arquivo sabe preço de token, e o custo já gravado em
 * pedidos antigos não é recalculado — é o que custou naquele dia, com aquele
 * câmbio, e reescrever isso apagaria o histórico contábil.
 */

/** Câmbio usado para converter a fatura em dólar. Ajuste quando destoar. */
export const DOLAR = 5.6;

/**
 * Preço por 1 milhão de tokens, em dólar.
 *
 * **Todo texto do sistema roda no Gemini.** O `3.5` escreve a leitura, que é o
 * produto; o `3.1` escreve o bilhete, os e-mails de remarketing e as falas do
 * ritual — trabalho pequeno, onde a diferença de qualidade some e a de preço
 * não. A OpenAI ficou só com a narração (`gpt-4o-mini-tts`), que é áudio.
 *
 * O `gpt-5.4` saiu daqui: escrevia bem, mas custava seis vezes o `3.5` na
 * entrada e trinta e sete vezes na saída, e demorava mais.
 */
const PRECO_POR_MILHAO = {
  'gemini-3.5-flash-lite': { entrada: 0.1, saida: 0.4 },
  'gemini-3.1-flash-lite': { entrada: 0.075, saida: 0.3 },
} as const;

export type ModeloDeTexto = keyof typeof PRECO_POR_MILHAO;

/** TTS é cobrado por minuto de áudio gerado, não por token de texto. */
const PRECO_TTS_POR_MINUTO = 0.015;

/** Fala em ritmo cerimonial: ~13 caracteres por segundo, medido no áudio real. */
const CARACTERES_POR_SEGUNDO = 13;

export function centavosDeTexto(params: {
  modelo?: ModeloDeTexto;
  tokensEntrada: number;
  tokensSaida: number;
}): number {
  const p = PRECO_POR_MILHAO[params.modelo ?? 'gemini-3.5-flash-lite'];
  const dolares =
    (params.tokensEntrada / 1_000_000) * p.entrada +
    (params.tokensSaida / 1_000_000) * p.saida;
  return Math.round(dolares * DOLAR * 100);
}

/**
 * O mesmo custo, em **milésimos de centavo**.
 *
 * ── O buraco que isto tapa, medido em produção ────────────────────────────
 *
 * Uma consulta ao Oráculo gasta ~650 tokens de entrada e ~580 de saída. Isso
 * dá 0,17 centavo. `centavosDeTexto` arredonda, e 0,17 arredondado é **zero**.
 *
 * O efeito: as sete leituras que existiam no banco em 01/09 somavam R$ 0,00.
 * Não é imprecisão — é a informação inteira desaparecendo. Cem consultas num
 * mês custam 17 centavos de verdade e continuariam somando zero, porque cada
 * parcela vira zero antes de entrar na soma.
 *
 * Do lado dos pedidos o arredondamento nunca incomodou: uma revelação inteira
 * gasta tokens o bastante (mais a narração) para cair entre 1 e 54 centavos. É
 * o uso miúdo e repetido da assinatura que o centavo não consegue representar
 * — e é justamente ele que precisa ser medido, porque acontece todo mês sem
 * venda nova pagando por ele.
 *
 * ── Por que milésimo, e não ponto flutuante ───────────────────────────────
 *
 * Somar `REAL` em SQLite acumula erro de representação, e dinheiro que soma
 * errado num painel é pior que dinheiro não medido: o número existe, parece
 * certo, e ninguém confere. Inteiro em unidade menor soma exato. Milésimo de
 * centavo dá ~1700 por consulta, com folga para o modelo ficar dez vezes mais
 * barato sem voltar a zerar.
 */
export function microcentavosDeTexto(params: {
  modelo?: ModeloDeTexto;
  tokensEntrada: number;
  tokensSaida: number;
}): number {
  const p = PRECO_POR_MILHAO[params.modelo ?? 'gemini-3.5-flash-lite'];
  const dolares =
    (params.tokensEntrada / 1_000_000) * p.entrada +
    (params.tokensSaida / 1_000_000) * p.saida;
  return Math.round(dolares * DOLAR * 100 * 1000);
}

export function centavosDeNarracao(caracteres: number): number {
  const minutos = caracteres / CARACTERES_POR_SEGUNDO / 60;
  return Math.round(minutos * PRECO_TTS_POR_MINUTO * DOLAR * 100);
}
