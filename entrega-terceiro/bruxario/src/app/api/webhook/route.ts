import { NextRequest, NextResponse } from 'next/server';
import { pagamento } from '@/nucleo/checkouts/directpag';
import { processarNotificacaoDePagamento } from '@/lib/webhook-pagamento';

/**
 * O postback do DirectPag — **a única fonte de verdade sobre pagamento**.
 *
 * O retorno do navegador não prova nada, e a resposta síncrona da criação da
 * transação também não: um Pix nasce `pending` e só vira `paid` quando a
 * pessoa efetivamente paga.
 *
 * ── O corpo da notificação é um AVISO, não um fato ────────────────────────
 *
 * O DirectPag **não assina o postback**: não há HMAC, não há header assinado,
 * a documentação não descreve verificação nenhuma. Quem descobrir esta URL
 * pode postar o que quiser.
 *
 * Por isso daqui só se aproveita **o id da transação**. O status real vem de
 * `consultarPagamento`, que é uma chamada NOSSA à API deles, autenticada com
 * o nosso token. Uma notificação forjada não entrega nada, porque quem decide
 * é a resposta do gateway — não quem bateu na porta.
 *
 * Aceitar o status vindo no corpo seria deixar qualquer um liberar produto
 * com um `curl`.
 *
 * ── Aceita os dois formatos ───────────────────────────────────────────────
 *
 * O id chega em `data.id`, em `hash`, em `transaction.hash` ou na query,
 * dependendo de como a venda nasceu — pela nossa API ou pelo checkout
 * hospedado deles. Ler os quatro custa nada e evita a pior falha possível:
 * alguém pagar e o postback ser descartado por causa do nome de um campo.
 *
 * ── Idempotência ──────────────────────────────────────────────────────────
 *
 * O DirectPag reenvia. `processarNotificacaoDePagamento` só age na primeira
 * transição de `aguardando_pagamento`, então o reenvio não gera segunda
 * entrega nem segundo evento de pixel.
 */
export async function POST(req: NextRequest) {
  const dataIdQuery = req.nextUrl.searchParams.get('data.id');

  const naoAutorizado = validarAssinatura(req, dataIdQuery);
  if (naoAutorizado) return naoAutorizado;

  try {
    const corpo = await req.json();

    /**
     * O id da transação, de onde ele vier.
     *
     * `200 ok` quando não há id: devolver erro faria o gateway retentar para
     * sempre uma notificação que nunca vai ter o que processar.
     */
    const idPagamento = String(
      corpo?.hash ??
        corpo?.transaction?.hash ??
        corpo?.data?.hash ??
        corpo?.data?.id ??
        dataIdQuery ??
        ''
    ).trim();
    if (!idPagamento) return NextResponse.json({ ok: true });

    const resultado = await pagamento.consultarPagamento(idPagamento);
    if (!resultado) {
      // Não deu para confirmar. 500 faz o gateway retentar, que é o que se
      // quer — melhor uma retentativa a mais que uma venda paga sem entrega.
      return NextResponse.json({ erro: 'indisponível' }, { status: 500 });
    }

    /**
     * O `await` espera só a parte SÍNCRONA: checar status, achar o pedido,
     * gravar `pago`. A geração roda em segundo plano, sem `await`, de
     * propósito — segurar a resposta pelo tempo que a IA e o PDF levam faria
     * o gateway considerar o postback falho e retentar em cima de uma entrega
     * que já está acontecendo.
     */
    await processarNotificacaoDePagamento(resultado);

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[api/webhook] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}

/** Janela contra replay. 5 min absorve deriva de relógio da VPS. */
export const TOLERANCIA_SEGUNDOS = 300;

function validarAssinatura(
  _req: NextRequest,
  _dataIdQuery: string | null
): NextResponse | null {
  /**
   * **O DirectPag não assina o postback.** Não há HMAC, não há header
   * assinado — a documentação não descreve verificação nenhuma. Qualquer um
   * que descubra esta URL pode fingir um pagamento aprovado.
   *
   * Por isso o corpo da notificação é tratado como AVISO, não como verdade:
   * dele só se aproveita o id da transação, e o status real vem de uma
   * consulta NOSSA à API (`consultarPagamento`), autenticada com o nosso
   * token. Notificação forjada não entrega nada, porque quem decide é a
   * resposta do gateway e não quem bateu na porta.
   *
   * Recusar aqui seria teatro: sem segredo compartilhado não há o que
   * conferir. A defesa real está uma camada adiante, e está escrita lá.
   */
  return null;
}

