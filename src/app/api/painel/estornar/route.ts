import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import { pagamento } from '@/lib/pagamento';
import { sessaoAtual } from '@/lib/sessao-servidor';

/**
 * Estorna uma compra. **A única rota do painel que escreve.**
 *
 * O painel foi feito somente-leitura de propósito: se a sessão vazar, o
 * estrago é ver dado, não mexer. Esta rota abre uma exceção, então carrega as
 * proteções que a exceção pede:
 *
 *  - **Sessão de admin obrigatória**, conferida no servidor.
 *  - **Confirmação digitada** no corpo do pedido. Não é teatro: impede que um
 *    clique errado, um duplo-clique ou um link malicioso em outra aba
 *    disparem estorno. O navegador não digita sozinho.
 *  - **Idempotência derivada do pagamento** (no provedor), então dois pedidos
 *    para o mesmo id não viram dois estornos.
 *
 * O que ela NÃO faz: apagar o pedido. A revelação continua acessível para
 * quem comprou. Estornar é devolver dinheiro, não punir — e tirar o produto
 * de alguém que já leu não recupera nada.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const { pedidoId, confirmacao } = (await req.json().catch(() => ({}))) ?? {};

  if (confirmacao !== 'ESTORNAR') {
    return NextResponse.json(
      { erro: 'confirmação ausente' },
      { status: 400 }
    );
  }

  const pedido = buscarPedido(pedidoId);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }
  if (!pedido.pagamento_id) {
    return NextResponse.json(
      { erro: 'este pedido não tem pagamento registrado' },
      { status: 400 }
    );
  }

  const resultado = await pagamento.estornar(pedido.pagamento_id);

  if (!resultado.ok) {
    registrarEvento('estorno_falhou', pedido.id);
    return NextResponse.json(
      { erro: resultado.erro ?? 'o Mercado Pago recusou o estorno' },
      { status: 502 }
    );
  }

  atualizarPedido(pedido.id, { status: 'estornado' });
  registrarEvento('estornado', pedido.id);

  return NextResponse.json({ ok: true });
}
