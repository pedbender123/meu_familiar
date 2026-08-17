import { gerarJson } from './gerar';
import { NOME_DO_DOMINIO, type PontuacaoDoDia } from '../calendario/pontuacao';

/**
 * A mensagem — o conselho curto do dia a dia.
 *
 * ── O contraste com a leitura é o produto ─────────────────────────────────
 *
 * Sem cerimônia, sem espetáculo, sem símbolo. Serve para tirar dúvida sobre
 * uma leitura anterior ("o que você quis dizer com aquilo da Torre?") ou
 * pedir um empurrão de duas linhas.
 *
 * É ela que faz a leitura parecer rara. Se a mensagem também viesse longa e
 * cerimoniosa, as duas moedas colapsariam numa só e o ritual perderia o
 * lugar dele.
 *
 * O contexto é estreito de propósito: o que já está registrado sobre a pessoa
 * + o céu dela hoje + o que ela escreveu agora. Nada de busca ampla — isso é
 * o que mantém a mensagem barata.
 */
export interface MensagemDoOraculo {
  resposta: string;
}

const ESQUEMA = {
  type: 'object',
  properties: { resposta: { type: 'string' } },
  required: ['resposta'],
};

export interface ContextoDaMensagem {
  nomeDoFamiliar: string;
  pergunta: string;
  pontuacaoDoDia: PontuacaoDoDia | null;
  faseDaLua: string;
  diaDeOuro: boolean;
  perfil?: string;
  /** Resumo das leituras dela — é o que faz ele parecer que lembra. */
  historico?: string[];
}

function montarPrompt(ctx: ContextoDaMensagem): string {
  const dia = ctx.pontuacaoDoDia
    ? Object.entries(ctx.pontuacaoDoDia)
        .map(
          ([d, n]) =>
            `${NOME_DO_DOMINIO[d as keyof typeof NOME_DO_DOMINIO]}: ${n}/100`
        )
        .join(' · ')
    : 'sem leitura do dia';

  return `Você é ${ctx.nomeDoFamiliar}, o familiar espiritual desta pessoa. Ela te
mandou uma mensagem rápida. Responda como quem conhece ela e está por perto —
curto, direto, sem cerimônia.

O QUE ELA DISSE:
"${ctx.pergunta}"

O CÉU DELA HOJE (matéria-prima — NUNCA cite números):
${dia} · ${ctx.faseDaLua}${ctx.diaDeOuro ? ' · HOJE É DIA DE OURO, raro, vale mencionar' : ''}
${ctx.perfil ? `\nO QUE VOCÊ SABE DELA:\n${ctx.perfil}` : ''}
${ctx.historico?.length ? `\nLEITURAS ANTERIORES DELA:\n${ctx.historico.map((h) => `- ${h}`).join('\n')}` : ''}

COMO RESPONDER:
- No máximo 4 frases. Isto é uma conversa, não uma leitura.
- Se ela perguntou sobre uma leitura anterior, responda sobre AQUILO.
- Convite, nunca previsão: "vale tentar", nunca "você vai".
- Nunca cite números ou notas.
- Se ela está pedindo algo que só uma leitura completa resolve (uma decisão
  grande, um panorama, "o que vai ser de mim"), diga isso com carinho e
  sugira que ela faça uma leitura — sem parecer vendedor.
- Sem markdown, sem asteriscos.`;
}

export async function gerarMensagem(ctx: ContextoDaMensagem) {
  return gerarJson<MensagemDoOraculo>('oraculo', montarPrompt(ctx), ESQUEMA);
}
