import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import { pagamento, pagamentoEhFake } from '@/lib/pagamento';
import { processarPedido } from '@/lib/processar';

const PRECO_CENTAVOS = parseInt(process.env.PRICE_CENTAVOS || '980', 10);

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  // Se a pessoa voltou pra essa página (ex.: apertou "voltar" no navegador
  // antes do redirecionamento automático do Asaas), o pedido pode já estar
  // pago/em geração/entregue — manda pro lugar certo em vez de erro.
  if (pedido.status === 'entregue') {
    return NextResponse.json({ redirect: `/revelacao/${id}` });
  }
  if (pedido.status === 'pago' || pedido.status === 'gerando') {
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }
  if (pedido.status === 'erro') {
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }

  try {
    if (pagamentoEhFake()) {
      atualizarPedido(id, { status: 'pago' });
      registrarEvento('pagamento_confirmado_fake', id);
      processarPedido(id);
      return NextResponse.json({ redirect: `/obrigado/${id}` });
    }

    // Já existe um checkout ativo pra esse pedido — reaproveita em vez de
    // criar outro (evita duas cobranças pendentes quando a página recarrega
    // antes do webhook confirmar o pagamento anterior).
    if (pedido.invoice_url) {
      return NextResponse.json({ redirect: pedido.invoice_url });
    }

    const cobranca = await pagamento.criarCobranca({
      pedidoId: id,
      valorCentavos: PRECO_CENTAVOS,
    });

    atualizarPedido(id, {
      asaas_payment_id: cobranca.idExterno,
      invoice_url: cobranca.url,
    });

    return NextResponse.json({ redirect: cobranca.url });
  } catch (erro) {
    console.error('[api/pedido/pagamento] erro ao criar cobrança:', erro);
    return NextResponse.json(
      { erro: 'O véu está denso esta noite. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
