import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, registrarEvento } from '@/lib/db';
import {
  pagamento,
  pagamentoEhFake,
  statusLiberaAcesso,
  type FormDataBrick,
} from '@/nucleo/checkouts/mercadopago';
import {
  PRECO_DA_MELHORIA_CENTAVOS,
  podeMelhorar,
  anotarPagamentoDaMelhoria,
  confirmarMelhoria,
} from '@/nucleo/melhoria';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';

/**
 * Cobra a melhoria — a troca da Revelação pela Completa depois da entrega.
 *
 * Mesma regra do funil: **quem libera é o webhook**, nunca a resposta daqui.
 * Cartão aprovado volta `approved` na hora e Pix volta `pending` com o QR, e
 * em nenhum dos dois casos o produto do pedido muda. A exceção é o modo fake,
 * onde não há webhook para chegar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`melhoria:${ip}`, LIMITES.pagamento)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  if (pedido.melhoria_paga_em || pedido.produto === 'completa') {
    return NextResponse.json({ redirect: `/revelacao/${id}` });
  }
  if (!podeMelhorar(pedido)) {
    return NextResponse.json({ erro: 'esta leitura não pode ser melhorada' }, { status: 400 });
  }

  if (pagamentoEhFake()) {
    await confirmarMelhoria(id);
    registrarEvento('melhoria_confirmada_fake', id);
    return NextResponse.json({ status: 'approved', redirect: `/revelacao/${id}` });
  }

  let form: FormDataBrick;
  try {
    const corpo = await req.json();
    form = corpo?.formData ?? corpo;
    if (!form?.payment_method_id) throw new Error('payment_method_id ausente');
  } catch {
    return NextResponse.json({ erro: 'dados de pagamento inválidos' }, { status: 400 });
  }

  try {
    const resultado = await pagamento.criarPagamento({
      form,
      /**
       * O `Cobravel` da melhoria, com preço próprio. Não é a diferença entre
       * os dois produtos: é uma oferta, e o valor dela é decidido aqui — não
       * derivado da tabela, que mudaria o preço da oferta sem ninguém pedir.
       */
      produto: {
        id: 'melhoria',
        descricao: 'Revelação Completa',
        precoCentavos: PRECO_DA_MELHORIA_CENTAVOS,
      },
      pedidoId: id,
      emailDoPedido: pedido.email,
      descontoPercentual: 0,
    });

    anotarPagamentoDaMelhoria(id, resultado.idExterno);
    registrarEvento(`melhoria_criada_${resultado.status}`, id);

    if (statusLiberaAcesso(resultado.status)) {
      return NextResponse.json({ status: resultado.status, redirect: `/revelacao/${id}` });
    }

    return NextResponse.json({
      status: resultado.status,
      statusDetalhe: resultado.statusDetalhe,
      ...(resultado.pix
        ? { pix: { copiaECola: resultado.pix.copiaECola, qrBase64: resultado.pix.qrBase64 } }
        : {}),
    });
  } catch (erro) {
    console.error('[melhorar] erro ao cobrar:', erro);
    return NextResponse.json(
      { erro: 'O véu está denso esta noite. Tente novamente em instantes.' },
      { status: 500 }
    );
  }
}
