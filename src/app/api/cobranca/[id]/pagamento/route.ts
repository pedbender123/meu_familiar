import { NextRequest, NextResponse } from 'next/server';
import {
  pagamento,
  pagamentoEhFake,
  statusLiberaAcesso,
  type FormDataBrick,
} from '@/nucleo/checkouts/mercadopago';
import {
  buscarCobranca,
  anotarPagamento,
  confirmarPagamento,
} from '@/nucleo/cobrancas';
import { buscarPlano } from '@/nucleo/planos';
import { registrarEvento } from '@/lib/db';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';
import { entregarChaveDaPlataforma, nomeDaConta } from '@/lib/acesso-plataforma';

/**
 * Cobra o plano — o gêmeo de `api/pedido/[id]/pagamento`, para assinatura.
 *
 * Mesma regra que vale no funil e vale aqui: **quem libera acesso é o
 * webhook**, nunca a resposta síncrona (SPEC 10.6). Cartão aprovado volta
 * `approved` na hora e Pix volta `pending` com o QR — em nenhum dos dois
 * casos esta rota cria assinatura. A exceção é o modo fake, onde não há
 * webhook para chegar.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`cobranca:${ip}`, LIMITES.pagamento)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const { id } = await params;
  const cobranca = buscarCobranca(id);
  if (!cobranca) {
    return NextResponse.json({ erro: 'cobrança não encontrada' }, { status: 404 });
  }

  if (cobranca.status === 'pago') {
    return NextResponse.json({ redirect: '/conta?assinatura=ok' });
  }

  const plano = buscarPlano(cobranca.plano_id);
  if (!plano) {
    return NextResponse.json({ erro: 'plano indisponível' }, { status: 400 });
  }

  if (pagamentoEhFake()) {
    const confirmada = confirmarPagamento(id, { metodo: 'fake' });
    registrarEvento('assinatura_confirmada_fake', id);
    // Sem webhook no modo fake, a chave sai daqui — senão testar o funil em
    // desenvolvimento sempre termina numa tela de login.
    if (confirmada?.assinatura) {
      await entregarChaveDaPlataforma({
        email: cobranca.email,
        nome: nomeDaConta(cobranca.email),
        contaNova: false,
      });
    }
    return NextResponse.json({ status: 'approved', redirect: '/conta?assinatura=ok' });
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
      // O plano é o `Cobravel`: só id, descrição e preço. O valor sai daqui,
      // do banco — nunca do que o navegador mandou.
      produto: {
        id: plano.id,
        descricao: plano.nome,
        precoCentavos: cobranca.valor_centavos,
      },
      pedidoId: cobranca.id,
      emailDoPedido: cobranca.email,
      descontoPercentual: 0,
    });

    anotarPagamento(id, resultado.idExterno);
    registrarEvento(`assinatura_pagamento_${resultado.status}`, id);

    return NextResponse.json({
      status: resultado.status,
      statusDetalhe: resultado.statusDetalhe,
      pix: resultado.pix,
      // `approved` aqui só informa a tela; a assinatura nasce no webhook.
      redirect: statusLiberaAcesso(resultado.status) ? '/conta?assinatura=ok' : undefined,
    });
  } catch (erro) {
    console.error('[cobranca] falha ao cobrar:', erro);
    return NextResponse.json(
      { erro: 'Não consegui processar o pagamento. Tente de novo.' },
      { status: 502 }
    );
  }
}
