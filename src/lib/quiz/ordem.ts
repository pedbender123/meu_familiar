import { ITENS } from './itens';

/**
 * Embaralha a ordem de exibição das opções (SPEC 2.6, efeito de ordem).
 *
 * Devolve os índices ORIGINAIS numa ordem nova — a resposta que volta para o
 * servidor continua sendo o índice do item, não a posição na tela.
 *
 * Mora aqui, e não dentro de `ritual/page.tsx`, porque agora há duas portas
 * para as mesmas 26 cenas: `/ritual` (quem veio da landing) e a raiz marcada
 * por campanha, que abre direto na primeira pergunta. Duas cópias da mesma
 * função é como o embaralhamento para de existir em uma delas sem ninguém
 * perceber — e aí o efeito de ordem volta só para metade do tráfego, que é
 * exatamente a metade que está sendo medida.
 */
export function ordemEmbaralhada(): Record<string, number[]> {
  const mapa: Record<string, number[]> = {};
  for (const item of ITENS) {
    const indices = item.opcoes.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    mapa[item.id] = indices;
  }
  return mapa;
}

/**
 * A cena que abre o ritual.
 *
 * ── Por que não é a `q01` ─────────────────────────────────────────────────
 *
 * A `q01` é sobre falar primeiro numa roda de conversa. Não tem lua, sonho,
 * bicho nem noite — nada que ligue ao anúncio que trouxe a pessoa até aqui.
 * Ela clicou em "descubra o familiar de bruxa que te escolheu" e a primeira
 * coisa que apareceu foi dinâmica de grupo.
 *
 * Os números de 21–23/08 mostraram o tamanho do estrago: **71 pessoas
 * chegaram e 43 saíram sem responder uma única cena.** 61% de abandono no
 * primeiro toque, contra perdas de 5% a 32% em todo o resto do funil.
 *
 * A `q17` fala a mesma língua do anúncio — um sonho que volta pela terceira
 * noite — e as opções dela têm de 4 a 8 palavras, contra 8 a 11 da `q01`. O
 * primeiro clique é o que precisa ser mais barato de todos, e era o mais caro.
 *
 * Trocar a abertura não mexe na pontuação: cada item carrega os próprios
 * `cargas`, e a soma independe da ordem em que as cenas aparecem.
 */
export const CENA_DE_ABERTURA = 'q17';

/**
 * As 26 cenas na ordem de exibição — a abertura primeiro, o resto como está.
 *
 * Mora aqui e não em `itens.ts` porque lá o array é agrupado por eixo, com
 * comentários de seção, e é assim que ele se lê. Arrancar um item do meio
 * daquele agrupamento para colar no topo tornaria as duas coisas piores: a
 * leitura do catálogo e a clareza de qual cena abre.
 */
export function itensNaOrdemDeExibicao(): typeof ITENS {
  const abertura = ITENS.find((i) => i.id === CENA_DE_ABERTURA);
  if (!abertura) return ITENS;
  return [abertura, ...ITENS.filter((i) => i.id !== CENA_DE_ABERTURA)];
}
