import { NextRequest, NextResponse } from 'next/server';
import { buscarPedidoHoroscopo, atualizarPedidoHoroscopo } from '@/lib/horoscopo/db';
import {
  pagamentoHoroscopo,
  pagamentoHoroscopoEhFake,
  type FormDataBrick,
} from '@/lib/horoscopo/pagamento';
import { gerarHoroscopo } from '@/lib/horoscopo/leitura';
import type { Signo } from '@/lib/astro';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const pedido = buscarPedidoHoroscopo(id);
    if (!pedido) return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
    if (pedido.status !== 'aguardando_pagamento') {
      return NextResponse.json({ erro: 'pedido já processado' }, { status: 400 });
    }

    // Sem gateway configurado: não existe MP real que vá chamar o webhook
    // depois, então quem libera o acesso é esta rota mesmo — mesmo padrão do
    // produto principal (ver api/pedido/[id]/pagamento/route.ts).
    if (pagamentoHoroscopoEhFake()) {
      const leitura = await gerarHoroscopo(
        pedido.nome,
        pedido.signo_sol as Signo,
        pedido.signo_lua as Signo
      );
      atualizarPedidoHoroscopo(id, {
        status: 'entregue',
        pagamento_id: `fake_${id}`,
        leitura_json: JSON.stringify(leitura),
      });
      return NextResponse.json({ status: 'approved' });
    }

    const { formData } = (await req.json()) as { formData: FormDataBrick };
    const resultado = await pagamentoHoroscopo.criarPagamento({ form: formData, pedidoId: id });

    atualizarPedidoHoroscopo(id, { pagamento_id: resultado.idExterno });

    if (resultado.pix) {
      return NextResponse.json({ status: resultado.status, pix: resultado.pix });
    }
    return NextResponse.json({ status: resultado.status, statusDetalhe: resultado.statusDetalhe });
  } catch (erro) {
    console.error('[api/horoscopo/pedido/pagamento] erro:', erro);
    return NextResponse.json({ erro: 'falha ao processar pagamento' }, { status: 500 });
  }
}
