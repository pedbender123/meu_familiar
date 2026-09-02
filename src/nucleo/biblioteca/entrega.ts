import db from '../../lib/db';
import { buscarEbook } from './catalogo';
import { desbloquear } from './desbloqueios';

/**
 * Libera os ebooks que a pessoa marcou no checkout.
 *
 * ── Chamado só pelo webhook ───────────────────────────────────────────────
 *
 * A regra que não se discute neste projeto: **só o webhook libera acesso.**
 * A resposta síncrona do gateway diz "aprovado" antes de o dinheiro existir —
 * e um livro liberado ali é um livro entregue numa compra que pode ser
 * recusada no minuto seguinte.
 *
 * ── Idempotente, e precisa ser ────────────────────────────────────────────
 *
 * O gateway reenvia a notificação até receber 200. `desbloquear` devolve
 * `null` quando a pessoa já tem o livro, então a segunda passagem não cria
 * direito nem receita duplicada.
 *
 * ── Por que lê do pedido, e não recebe a lista ────────────────────────────
 *
 * Porque a lista que vale é a que foi COBRADA, e ela está gravada no pedido
 * desde antes da cobrança sair. Receber a lista de fora abriria caminho para
 * entregar um conjunto diferente do que foi pago — em qualquer das duas
 * direções, e as duas são ruins.
 */
export function entregarBumpsDoPedido(pedidoId: string): string[] {
  const pedido = db
    .prepare('SELECT id, email, bumps_json FROM pedidos WHERE id = ?')
    .get(pedidoId) as { id: string; email: string | null; bumps_json: string | null } | undefined;

  if (!pedido?.email || !pedido.bumps_json) return [];

  let ids: unknown;
  try {
    ids = JSON.parse(pedido.bumps_json);
  } catch {
    // JSON quebrado no pedido não pode derrubar a entrega da leitura.
    console.error(`[biblioteca] bumps_json ilegível no pedido ${pedidoId}`);
    return [];
  }
  if (!Array.isArray(ids)) return [];

  const entregues: string[] = [];
  for (const id of ids) {
    const ebook = buscarEbook(typeof id === 'string' ? id : '');
    if (!ebook) continue;

    /*
      O preço vai do CATÁLOGO, não rateado do total.

      Ratear seria inventar: se um dia um bump tiver desconto, o rateio
      distribuiria o desconto por todos os itens e nenhum deles teria o preço
      que a pessoa viu na tela.
    */
    const novo = desbloquear({
      email: pedido.email,
      ebookId: ebook.id,
      origem: 'bump',
      pedidoId: pedido.id,
      precoCentavos: ebook.precoCentavos,
    });
    if (novo) entregues.push(ebook.id);
  }

  if (entregues.length > 0) {
    console.log(
      `[biblioteca] pedido ${pedidoId}: ${entregues.length} ebook(s) liberado(s) — ` +
        entregues.join(', ')
    );
  }

  return entregues;
}
