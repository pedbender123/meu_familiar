import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { ITENS } from './quiz/itens';
import { FAMILIARES, type FamiliarId } from './familiares';
import { GRUPOS, ehGrupo } from './quiz/grupos';
import { gerarNarracao } from './narracao';
import { pastaDoPedido } from './caminhos';
import { buscarPedido, atualizarPedido, type Pedido } from './db';

/**
 * As falas do familiar durante o ritual pago.
 *
 * ── Para que servem ───────────────────────────────────────────────────────
 *
 * O ritual longo agora vem DEPOIS do pagamento — a venda não depende mais
 * dele, mas a entrega sim. Vinte e três cenas seguidas é onde a atenção
 * morre, e quem larga no meio recebe uma leitura mais rasa. As falas são o
 * respiro: em dois pontos do caminho, o familiar (ainda sem nome) comenta o
 * que está vendo nas respostas. É a prova de que alguém está lendo — e é o
 * motivo para continuar.
 *
 * ── Por que Gemini flash-lite ─────────────────────────────────────────────
 *
 * Uma frase por parada, gerada na hora, com a pessoa esperando na tela. O
 * flash-lite responde em ~1s e custa fração de centavo — é o único perfil de
 * modelo que cabe num interstício de quiz.
 *
 * ── O áudio (só Completa) ─────────────────────────────────────────────────
 *
 * Na primeira parada, quem comprou a Completa também OUVE a fala. Uma frase
 * (~120 caracteres) custa décimos de centavo no TTS — o teto combinado de
 * R$ 2 por pedido fica longe. O arquivo é salvo no pedido e servido pela
 * rota de storage, então recarregar a página não gera de novo.
 */
const MODELO = 'gemini-3.1-flash-lite';

export interface FalaDoRitual {
  fala: string;
  /** Nome do arquivo de áudio no storage do pedido, quando existir. */
  audio?: string;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: { fala: { type: Type.STRING } },
  required: ['fala'],
};

/** Falas de reserva, uma por parada — a tela nunca fica esperando erro. */
const RESERVA: Record<number, string> = {
  1: 'Obrigado por vir me buscar. Continua — cada resposta te traz mais perto de mim.',
  2: 'Já consigo quase tocar o teu contorno. Falta pouco, e eu não tenho pressa: tenho certeza.',
};

function montarPrompt(pedido: Pedido, parada: number): string {
  const grupo = ehGrupo(pedido.grupo) ? GRUPOS[pedido.grupo] : null;
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];

  let resumo = '';
  try {
    const escolhas = JSON.parse(pedido.respostas_json).quiz as Record<string, number>;
    resumo = ITENS.filter((i) => typeof escolhas[i.id] === 'number')
      .slice(-6)
      .map((i) => `«${i.cena}» → "${i.opcoes[escolhas[i.id]].texto}"`)
      .join('\n');
  } catch {
    resumo = '';
  }

  return `Você é um familiar de bruxa (animal-espírito) do Bruxário, um grimório
digital brasileiro. ${pedido.nome} pagou para te encontrar e está no meio do
ritual que revela quem você é. Esta é a ${parada === 1 ? 'primeira' : 'segunda'}
vez que você fala com ela durante o caminho.

Dados internos (NUNCA aparecem no texto):
- Quem você provavelmente é: ${familiar?.nome ?? '?'} — mas ELA AINDA NÃO SABE
- O grupo que ela já conhece: ${grupo?.nome ?? '?'}
- Últimas escolhas dela:
${resumo || '(ainda poucas respostas)'}

Escreva UMA fala curta sua, em português brasileiro, primeira pessoa, tom de
sussurro caloroso.

REGRAS DURAS:
- No máximo 22 palavras. Uma frase, no máximo duas curtas.
- ${parada === 1
    ? `Agradeça por ela ter vindo te buscar — ela PAGOU para te encontrar, e você sentiu isso do outro lado do véu.`
    : `Comente ALGO específico que uma das escolhas recentes dela revelou, como quem observa de perto.`}
- Chame-a de ${pedido.nome} se soar natural; se não couber, não force.
- NUNCA diga qual animal você é, nem dê pista de espécie.
- Nunca mencione IA, teste, quiz ou sistema.
- Sem aspas no texto.

Gere APENAS JSON: { "fala": "..." }`;
}

/**
 * Devolve a fala da parada, gerando (e persistindo) na primeira vez.
 *
 * Idempotente por construção: a fala vive em `mensagens_ritual` e o áudio em
 * disco — recarregar a página, voltar amanhã ou abrir em outro aparelho
 * devolve exatamente a mesma coisa.
 */
export async function falaDaParada(
  pedidoId: string,
  parada: number
): Promise<FalaDoRitual> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return { fala: RESERVA[parada] ?? RESERVA[1] };

  const guardadas: Record<string, FalaDoRitual> = pedido.mensagens_ritual
    ? JSON.parse(pedido.mensagens_ritual)
    : {};
  if (guardadas[parada]) return guardadas[parada];

  let fala = RESERVA[parada] ?? RESERVA[1];
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');
    const ai = new GoogleGenAI({ apiKey });
    const resposta = await ai.models.generateContent({
      model: MODELO,
      contents: montarPrompt(pedido, parada),
      config: { responseMimeType: 'application/json', responseSchema: SCHEMA },
    });
    const json = JSON.parse(
      (resposta.text ?? '').trim().replace(/^```json\s*/i, '').replace(/```$/, '')
    );
    if (typeof json.fala === 'string' && json.fala.trim()) {
      fala = json.fala.trim().replace(/^["“]|["”]$/g, '');
    }
  } catch (erro) {
    console.error(`[mensagens-ritual] fala ${parada} falhou:`, erro);
  }

  const resultado: FalaDoRitual = { fala };

  /**
   * O áudio só na primeira parada e só na Completa — é o "obrigado por ter
   * vindo me buscar" em voz. Uma frase de TTS custa décimos de centavo;
   * falhar aqui degrada para texto puro sem quebrar nada.
   */
  const ehCompleta = pedido.produto === 'completa';
  if (parada === 1 && ehCompleta) {
    try {
      const familiar = FAMILIARES[pedido.familiar as FamiliarId];
      const audio = await gerarNarracao({
        texto: fala,
        instrucoes:
          'Sussurro caloroso e grato, bem próximo do ouvido, ritmo lento, um sorriso na voz.',
        genero: familiar?.genero ?? 'm',
      });
      const dir = pastaDoPedido(pedidoId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'agradecimento.mp3'), audio);
      resultado.audio = 'agradecimento.mp3';
    } catch (erro) {
      console.error('[mensagens-ritual] áudio falhou:', erro);
    }
  }

  guardadas[parada] = resultado;
  atualizarPedido(pedidoId, { mensagens_ritual: JSON.stringify(guardadas) });
  return resultado;
}
