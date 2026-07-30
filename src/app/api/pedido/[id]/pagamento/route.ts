import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import {
  pagamento,
  pagamentoEhFake,
  statusLiberaAcesso,
  type FormDataBrick,
} from '@/lib/pagamento';
import { produtoDe } from '@/lib/produtos';
import { processarPedido } from '@/lib/processar';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Recebe o `formData` do Payment Brick e cria o pagamento no Mercado Pago.
 *
 * Diferente da versão Asaas, esta rota **não redireciona para gateway nenhum** —
 * o Brick já coletou tudo no nosso site. Ela devolve o status para a tela
 * decidir o que mostrar: aprovado vai pra geração, Pix mostra o QR, recusado
 * pede outro cartão.
 *
 * O que ela deliberadamente NÃO faz: confiar no status para liberar acesso
 * quando o gateway é real. Quem libera é o webhook (SPEC 10.6). Aqui o pedido
 * só sai de `aguardando_pagamento` no modo fake.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(ip)) {
    return NextResponse.json(
      { erro: 'Muitas tentativas. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  // Se a pessoa voltou pra essa tela com o pedido já adiantado, manda pro
  // lugar certo em vez de cobrar de novo.
  if (pedido.status === 'entregue') {
    return NextResponse.json({ redirect: `/revelacao/${id}` });
  }
  if (
    pedido.status === 'pago' ||
    pedido.status === 'gerando' ||
    pedido.status === 'erro'
  ) {
    return NextResponse.json({ redirect: `/obrigado/${id}` });
  }

  if (pagamentoEhFake()) {
    atualizarPedido(id, { status: 'pago' });
    registrarEvento('pagamento_confirmado_fake', id);
    processarPedido(id);
    return NextResponse.json({ status: 'approved', redirect: `/obrigado/${id}` });
  }

  let form: FormDataBrick;
  try {
    const corpo = await req.json();
    form = corpo?.formData ?? corpo;
    if (!form?.payment_method_id) throw new Error('payment_method_id ausente');
  } catch {
    return NextResponse.json(
      { erro: 'dados de pagamento inválidos' },
      { status: 400 }
    );
  }

  try {
    const resultado = await pagamento.criarPagamento({
      form,
      produto: produtoDe(pedido.produto),
      pedidoId: id,
      emailDoPedido: pedido.email,
    });

    atualizarPedido(id, {
      pagamento_id: resultado.idExterno,
      ...(resultado.pix ? { pix_copia_e_cola: resultado.pix.copiaECola } : {}),
    });
    registrarEvento(`pagamento_criado_${resultado.status}`, id);

    // Cartão aprovado: quem confirma de verdade é o webhook, mas mandar a
    // pessoa pra tela de espera já é correto — /obrigado faz poll até
    // `entregue`, então ela vê o resultado assim que a geração terminar.
    if (statusLiberaAcesso(resultado.status)) {
      return NextResponse.json({
        status: resultado.status,
        redirect: `/obrigado/${id}`,
      });
    }

    return NextResponse.json({
      status: resultado.status,
      statusDetalhe: resultado.statusDetalhe,
      ...(resultado.pix
        ? {
            pix: {
              copiaECola: resultado.pix.copiaECola,
              qrBase64: resultado.pix.qrBase64,
            },
          }
        : {}),
    });
  } catch (erro) {
    console.error('[api/pedido/pagamento] erro ao criar pagamento:', erro);
    return NextResponse.json(
      { erro: 'O véu está denso esta noite. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
