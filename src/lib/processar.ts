import { buscarPedido, atualizarPedido, registrarEvento } from './db';
import { FAMILIARES, type FamiliarId, type LuaId } from './familiares';
import { calcularSignos } from './astro';
import { gerarLeitura } from './leitura';
import { gerarArtes } from './arte';
import { gerarPdf } from './pdf';
import { enviarRevelacao } from './email';

/**
 * Roda em background após a confirmação de pagamento: calcula signos, gera a
 * leitura (Gemini), compõe as artes (sharp) e o PDF e marca `entregue`.
 * Nunca deve lançar para o chamador — erros marcam `erro` para o job de
 * reprocessamento pegar depois.
 *
 * A entrega tem dois caminhos, e os dois importam: o link (para onde
 * /obrigado/[id] redireciona sozinho) e o e-mail com o PDF anexado. O segundo
 * existe porque o link da Revelação **expira em 7 dias** — sem o anexo, quem
 * pagou R$ 9,80 ficaria sem cópia nenhuma depois disso.
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

    // O e-mail é o último passo e falha isolada: se o Resend estiver fora do
    // ar, a revelação já está gerada e acessível pelo link. Marcar o pedido
    // como `erro` por causa disso faria o job de reprocessamento gerar tudo de
    // novo — inclusive uma segunda chamada paga ao Gemini.
    try {
      await enviarRevelacao({
        nome: pedido.nome,
        email: pedido.email,
        pedidoId,
        produtoId: pedido.produto,
        nomeFamiliar: familiar.nome,
        nomeSecreto: leitura.nome_secreto,
        expiraEm: pedido.expira_em,
      });
    } catch (erroEmail) {
      console.error(`[processarPedido] e-mail falhou no pedido ${pedidoId}:`, erroEmail);
      registrarEvento('email_falhou', pedidoId);
    }
  } catch (erro) {
    console.error(`[processarPedido] erro no pedido ${pedidoId}:`, erro);
    atualizarPedido(pedidoId, { status: 'erro' });
    registrarEvento('pedido_erro', pedidoId);
  }
}
