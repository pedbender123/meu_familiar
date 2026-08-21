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
