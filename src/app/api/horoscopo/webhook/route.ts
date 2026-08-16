import { NextRequest, NextResponse } from 'next/server';
import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago';
import {
  buscarPedidoHoroscopo,
  buscarPedidoHoroscopoPorPagamentoId,
  atualizarPedidoHoroscopo,
} from '@/lib/horoscopo/db';
import {
  pagamentoHoroscopo,
  segredoDoWebhookHoroscopo,
  statusLiberaAcessoHoroscopo,
} from '@/lib/horoscopo/pagamento';
import { gerarHoroscopo } from '@/lib/horoscopo/leitura';
import type { Signo } from '@/lib/astro';

/**
 * Webhook PRÓPRIO do Horóscopo — cópia deliberada do padrão de
 * `api/webhook/route.ts` (validação de assinatura, consulta à API em vez de
 * confiar no corpo, idempotência), mas apontando para uma app MP e um banco
 * inteiramente separados. Nunca importa nada do webhook principal: um bug
 * aqui não pode vazar para o produto que já está rodando.
 */
const TOLERANCIA_SEGUNDOS = 300;

export async function POST(req: NextRequest) {
  const dataIdQuery = req.nextUrl.searchParams.get('data.id');

  const naoAutorizado = validarAssinatura(req, dataIdQuery);
  if (naoAutorizado) return naoAutorizado;

  try {
    const corpo = await req.json();
    const tipo = corpo?.type ?? corpo?.topic;
    if (tipo !== 'payment') return NextResponse.json({ ok: true });

    const idPagamento = String(corpo?.data?.id ?? dataIdQuery ?? '');
    if (!idPagamento) return NextResponse.json({ ok: true });

    const resultado = await pagamentoHoroscopo.consultarPagamento(idPagamento);
    if (!resultado) {
      return NextResponse.json({ erro: 'indisponível' }, { status: 500 });
    }

    if (!statusLiberaAcessoHoroscopo(resultado.status)) {
      return NextResponse.json({ ok: true });
    }

    const pedido =
      buscarPedidoHoroscopoPorPagamentoId(idPagamento) ??
      (resultado.referenciaExterna
        ? buscarPedidoHoroscopo(resultado.referenciaExterna)
        : undefined);

    if (!pedido) {
      console.warn(`[horoscopo/webhook] pagamento ${idPagamento} sem pedido correspondente`);
      return NextResponse.json({ ok: true });
    }

    if (pedido.status !== 'aguardando_pagamento') {
      return NextResponse.json({ ok: true });
    }

    atualizarPedidoHoroscopo(pedido.id, { status: 'pago', pagamento_id: idPagamento });

    try {
      const leitura = await gerarHoroscopo(
        pedido.nome,
        pedido.signo_sol as Signo,
        pedido.signo_lua as Signo
      );
      atualizarPedidoHoroscopo(pedido.id, {
        status: 'entregue',
        leitura_json: JSON.stringify(leitura),
      });
    } catch (erroGeracao) {
      // Pago mas sem leitura ainda: fica em 'pago'. A página de resultado
      // tenta gerar sob demanda quando a pessoa chegar lá — ver
      // app/horoscopo/revelacao/[id]/page.tsx.
      console.error('[horoscopo/webhook] falha ao gerar leitura:', erroGeracao);
    }

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[api/horoscopo/webhook] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}

function validarAssinatura(
  req: NextRequest,
  dataIdQuery: string | null
): NextResponse | null {
  const segredo = segredoDoWebhookHoroscopo();

  if (!segredo) {
    console.warn('[horoscopo/webhook] segredo ausente para o modo atual: assinatura NÃO validada');
    return null;
  }

  const xSignature = req.headers.get('x-signature');

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId: req.headers.get('x-request-id'),
      dataId: dataIdQuery,
      secret: segredo,
    });
  } catch (erro) {
    if (erro instanceof InvalidWebhookSignatureError) {
      console.warn(`[horoscopo/webhook] assinatura inválida (${erro.reason})`);
      return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
    }
    throw erro;
  }

  if (!dentroDaJanela(xSignature)) {
    console.warn('[horoscopo/webhook] timestamp fora da janela de replay');
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  return null;
}

function dentroDaJanela(xSignature: string | null, agora = Date.now()): boolean {
  if (!xSignature) return false;
  const ts = xSignature
    .split(',')
    .map((parte) => parte.trim().split('='))
    .find(([chave]) => chave === 'ts')?.[1];
  if (!ts || !/^\d+$/.test(ts)) return false;
  const numero = Number(ts);
  const ms = numero < 1e11 ? numero * 1000 : numero;
  return Math.abs(agora - ms) / 1000 <= TOLERANCIA_SEGUNDOS;
}
