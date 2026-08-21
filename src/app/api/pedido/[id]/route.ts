import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido } from '@/lib/db';
import { produtoDe, type ProdutoId } from '@/lib/produtos';
import { destinoDepoisDaEntrega, precoVigenteCentavos } from '@/lib/modelo-de-venda';
import { precoDoPedido } from '@/lib/cupons';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }
  return NextResponse.json({
    status: pedido.status,
    nome: pedido.nome,
    // A tela pós-pagamento usa isto para decidir se pede o endereço. Vai o
    // booleano, nunca o e-mail: o id do pedido circula em URL e não deve ser
    // suficiente para descobrir o endereço de quem comprou.
    temEmail: !!pedido.email,
    // A tela pós-pagamento usa isto para saber se manda a pessoa responder as
    // 26 cenas ou se fica esperando a geração terminar.
    ritualCompleto: pedido.ritual_completo === 1,
    /**
     * Para onde ir quando a entrega terminar.
     *
     * Decidido no SERVIDOR porque depende do interruptor do modelo de venda —
     * oferta de três degraus quando ligado, revelação direto quando não. O
     * navegador não precisa conhecer essa regra, e se conhecesse ela ficaria
     * congelada no pacote até o próximo deploy.
     */
    destino: destinoDepoisDaEntrega(id),
    // Para o Purchase do Pixel disparar em /obrigado — a mesma aba que pagou,
    // sem depender de sessão logada. Mesmo cálculo de valor usado em
    // /revelacao/[id] (bruto cobrado de verdade, com cupom já aplicado).
    valorCentavos: pedido.bruto_centavos ?? precoDoPedido(pedido).finalCentavos,
    exemplo: pedido.exemplo === 1,
  });
}
