import { buscarPedido, atualizarPedido, registrarEvento } from './db';
import { FAMILIARES, type FamiliarId, type LuaId } from './familiares';
import { calcularSignos } from './astro';
import { gerarLeitura } from './leitura';
import { gerarArtes } from './arte';
import { gerarPdf } from './pdf';

/**
 * Roda em background após a confirmação de pagamento: calcula signos, gera a
 * leitura (Gemini), compõe as artes (sharp) e o PDF e marca `entregue`.
 * Nunca deve lançar para o chamador — erros marcam `erro` para o job de
 * reprocessamento pegar depois.
 *
 * Não há envio de e-mail: a entrega é o próprio link permanente
 * (/revelacao/[id]), para onde /obrigado/[id] redireciona sozinho quando o
 * status vira `entregue`.
 */
export async function processarPedido(pedidoId: string): Promise<void> {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return;
  if (pedido.status !== 'pago' && pedido.status !== 'erro') return;

  try {
    atualizarPedido(pedidoId, { status: 'gerando', tentativas: pedido.tentativas + 1 });
    registrarEvento('geracao_iniciada', pedidoId);

    const respostas = JSON.parse(pedido.respostas_json);
    const familiar = FAMILIARES[pedido.familiar as FamiliarId];
    const { signoSol, signoLua } = calcularSignos(respostas.dataNascimento, respostas.horaNascimento);

    const resumoRespostas = Object.entries(respostas.quiz as Record<string, string>)
      .map(([pergunta, letra]) => `P${pergunta}:${letra}`)
      .join(', ');

    const leitura = await gerarLeitura({
      nome: pedido.nome,
      familiar,
      signoSol,
      signoLua,
      lua: pedido.lua as LuaId,
      resumoRespostas,
    });

    const { storyPath } = await gerarArtes(pedidoId, {
      nome: pedido.nome,
      familiar,
      lua: pedido.lua as LuaId,
      signoSol,
      signoLua,
      leitura,
    });

    await gerarPdf(pedidoId, {
      nome: pedido.nome,
      familiar,
      leitura,
      storyPngPath: storyPath,
    });

    atualizarPedido(pedidoId, {
      status: 'entregue',
      signo_sol: signoSol,
      signo_lua: signoLua,
      leitura_json: JSON.stringify(leitura),
    });
    registrarEvento('pedido_entregue', pedidoId);
  } catch (erro) {
    console.error(`[processarPedido] erro no pedido ${pedidoId}:`, erro);
    atualizarPedido(pedidoId, { status: 'erro' });
    registrarEvento('pedido_erro', pedidoId);
  }
}
