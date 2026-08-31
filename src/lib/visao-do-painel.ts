import { cookies } from 'next/headers';

/**
 * De que lugar a pessoa está olhando o painel.
 *
 * ── Por que isto não é permissão ──────────────────────────────────────────
 *
 * Quem pode o quê já é decidido por `podeEditarPainel` — o dono altera, a
 * equipe só olha. Isto é outra coisa: é o **recorte**, e ele existe porque as
 * duas leituras do mesmo painel são incompatíveis.
 *
 * Quem cuida do produto quer ver tudo: pedidos, assinaturas, cupons, custo de
 * IA, saúde do fluxo. Quem compra a mídia quer ver uma coisa só — o que cada
 * anúncio trouxe — e cada item de menu a mais é um lugar para se perder e uma
 * pergunta que vai voltar para o dono responder.
 *
 * ── Por que cookie, e não localStorage ────────────────────────────────────
 *
 * O menu é montado no servidor. Com `localStorage`, o servidor mandaria o
 * menu completo e o navegador apagaria itens depois de pintar — a tela
 * piscando itens que a pessoa não deveria ver. O cookie chega junto com a
 * requisição, então a página já nasce certa.
 *
 * ── Por que não trava nada ────────────────────────────────────────────────
 *
 * A visão de vendedor **esconde, não protege**. Trocar o cookie à mão não dá
 * acesso a nada: quem entra no painel já passou pela autenticação, e a
 * distinção de poder continua sendo a de sempre. Tratar isto como segurança
 * seria confiar num valor que o próprio navegador escreve.
 */
export type Visao = 'admin' | 'vendedor';

export const COOKIE_DA_VISAO = 'bx_visao';

export function ehVisao(v: unknown): v is Visao {
  return v === 'admin' || v === 'vendedor';
}

/** Ausente = admin: quem nunca escolheu nada continua vendo o painel inteiro. */
export async function visaoAtual(): Promise<Visao> {
  const bruto = (await cookies()).get(COOKIE_DA_VISAO)?.value;
  return ehVisao(bruto) ? bruto : 'admin';
}

/**
 * As áreas que sobrevivem à visão de vendedor.
 *
 * A régua para entrar nesta lista: **serve para decidir qual anúncio pausa ou
 * escala?** Pedidos, cupons, assinaturas e saúde do fluxo não servem — são
 * operação de produto, e quem compra mídia não tem o que fazer com elas.
 *
 * A Central fica porque é o único lugar que responde "e o site como um todo,
 * como foi hoje" — a pergunta que vem logo depois de "e a minha campanha".
 */
export const AREAS_DO_VENDEDOR: readonly string[] = [
  '/painel/central',
  '/painel/campanhas',
];

export function areaVisivel(href: string, visao: Visao): boolean {
  if (visao === 'admin') return true;
  return AREAS_DO_VENDEDOR.some((a) => href === a || href.startsWith(`${a}/`));
}
