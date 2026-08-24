import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ProvedorCakto, segredoDoWebhook } from '@/nucleo/checkouts/cakto';
import { processarNotificacaoDePagamento } from '@/lib/webhook-pagamento';

/**
 * Webhook da Cakto — **a única fonte de verdade sobre pagamento** (SPEC 10.6).
 *
 * Rota separada da do Mercado Pago de propósito. Durante a virada os dois
 * gateways ficam de pé ao mesmo tempo: quem comprou pelo MP há dez minutos
 * ainda vai receber a notificação dele, e um handler só, tentando adivinhar
 * quem mandou o quê pelo formato do corpo, é o tipo de esperteza que falha
 * exatamente na noite da migração.
 *
 * ── A diferença que importa ───────────────────────────────────────────────
 *
 * O Mercado Pago assina o corpo com HMAC num header. **A Cakto não assina
 * nada**: a validação é um campo `secret` DENTRO do JSON. Isso é mais fraco,
 * e muda duas coisas para nós:
 *
 *   1. HTTPS deixa de ser boa prática e vira requisito — o segredo viaja no
 *      corpo, em texto, a cada notificação
 *   2. a comparação precisa ser em tempo constante. Um `===` vaza, pelo tempo
 *      que leva para falhar, quantos caracteres iniciais estavam certos — o
 *      bastante para descobrir o segredo caractere a caractere
 *
 * ── O que NÃO mudou ───────────────────────────────────────────────────────
 *
 * O status vem de uma **consulta à API deles**, nunca do corpo. O corpo diz
 * `"status"`, e acreditar nele seria deixar qualquer um liberar acesso
 * forjando um POST com o segredo vazado. E é a consulta que traz o `sck` — o
 * nosso `pedidoId` —, que o corpo não carrega.
 */

const cakto = new ProvedorCakto();

/**
 * Comparação em tempo constante, tolerando tamanhos diferentes.
 *
 * `timingSafeEqual` **lança** quando os buffers têm tamanhos diferentes, e
 * deixar essa exceção subir devolveria 500 no lugar de 401 — além de vazar,
 * pela própria diferença de resposta, que o tamanho não bate.
 */
function segredoConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const esperado = segredoDoWebhook();

  if (!esperado) {
    // Sem segredo não há como distinguir a Cakto de qualquer um na internet.
    // Diferente do MP, aqui isso não é "aceitável em dev": o corpo é a única
    // credencial que existe. Recusa.
    console.error('[webhook/cakto] CAKTO_WEBHOOK_SECRET ausente — recusando tudo');
    return NextResponse.json({ erro: 'não configurado' }, { status: 401 });
  }

  let corpo: { secret?: unknown; event?: unknown; data?: { id?: unknown } };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  if (!segredoConfere(corpo?.secret, esperado)) {
    console.warn('[webhook/cakto] segredo não confere');
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const idPedidoCakto = String(corpo?.data?.id ?? '');
  if (!idPedidoCakto) {
    // Evento sem id não tem o que processar. `2xx` porque retentar não muda
    // nada — a Cakto reenviaria a mesma coisa cinco vezes à toa.
    return NextResponse.json({ ok: true });
  }

  try {
    const resultado = await cakto.consultarPagamento(idPedidoCakto);

    if (!resultado) {
      // Não deu para confirmar. 500 faz a Cakto retentar (5s, 1min, 2min30,
      // 6min, 30min), que é o que queremos: melhor uma retentativa que uma
      // venda paga sem entrega.
      return NextResponse.json({ erro: 'indisponível' }, { status: 500 });
    }

    /**
     * O `await` aqui espera só a parte SÍNCRONA — checar status, achar o
     * pedido, gravar `pago`. A entrega (`resultado.entrega`) roda em segundo
     * plano sem `await`, de propósito: a Cakto corta em **8 segundos** e
     * considera timeout, reenviando o evento mesmo que a gente já tenha
     * processado. Segurar a resposta pelo tempo da geração garantiria isso.
     */
    await processarNotificacaoDePagamento(resultado);

    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[webhook/cakto] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}
