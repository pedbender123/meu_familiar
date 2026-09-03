import db from '../../lib/db';
import { buscarEbook } from './catalogo';
import { desbloquear, ligarDesbloqueiosAConta } from './desbloqueios';
import { garantirConta, criarTokenMagico } from '../../lib/autenticacao';
import { enviarLivrosComprados } from '../../lib/email';

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
    .prepare('SELECT id, nome, email, bumps_json FROM pedidos WHERE id = ?')
    .get(pedidoId) as
    | { id: string; nome: string | null; email: string | null; bumps_json: string | null }
    | undefined;

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
    void avisarQueChegou(pedido.email, pedido.nome ?? '', entregues);
  }

  return entregues;
}

/**
 * O e-mail com o caminho até os livros.
 *
 * ── Sem ele, a pessoa paga e não tem como chegar ──────────────────────────
 *
 * O ebook é adicional de checkout, e o que ela recebe não é arquivo: é acesso
 * a uma leitura dentro do app. Sem este aviso ela veria "obrigado" na tela e
 * precisaria descobrir sozinha que existe uma biblioteca — e adivinhar que
 * precisa entrar na conta para achá-la.
 *
 * Isso não vira chamado de suporte. Vira estorno.
 *
 * ── Link mágico, e não uma tela de login ──────────────────────────────────
 *
 * Pedir senha a quem acabou de pagar é pôr uma porta entre a pessoa e o que
 * ela comprou. O link já entra logado e cai direto na estante.
 *
 * ── Nunca derruba a entrega ───────────────────────────────────────────────
 *
 * Roda sem `await` e engole o próprio erro. O direito já foi gravado antes: se
 * o e-mail falhar, a pessoa continua dona dos livros e os encontra no próximo
 * login. Falhar ao avisar não pode desfazer o que foi entregue.
 */
async function avisarQueChegou(
  email: string,
  nome: string,
  ids: string[]
): Promise<void> {
  try {
    const livros = ids
      .map((id) => buscarEbook(id))
      .filter((e): e is NonNullable<typeof e> => !!e)
      .map((e) => ({ titulo: e.titulo, capitulos: e.capitulos }));

    if (livros.length === 0) return;

    /*
      A conta nasce aqui, se ainda não existia.

      Quem marcou o bump veio do ritual e pode nunca ter feito login — o
      direito ficou preso ao e-mail. Criar a conta agora e ligar os
      desbloqueios a ela é o que faz o link do e-mail já abrir a estante
      cheia, em vez de abrir uma estante vazia que só se enche depois.
    */
    const conta = garantirConta(email);
    ligarDesbloqueiosAConta(email, conta.id);

    const base = process.env.BASE_URL || 'http://localhost:3000';
    const token = criarTokenMagico(email, 'conta');
    const url =
      `${base}/entrar/verificar?t=${encodeURIComponent(token)}` +
      `&e=lg&destino=${encodeURIComponent('/conta/biblioteca')}`;

    await enviarLivrosComprados({ nome: nome || email.split('@')[0], email, url, livros });
  } catch (erro) {
    console.error('[biblioteca] falha ao avisar sobre os livros:', erro);
  }
}
