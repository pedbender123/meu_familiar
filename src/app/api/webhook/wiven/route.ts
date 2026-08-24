import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  tokenDoWebhook,
  traduzirWebhook,
  type CorpoWebhookWiven,
} from '@/nucleo/checkouts/wiven';
import { processarNotificacaoDePagamento } from '@/lib/webhook-pagamento';
import { buscarPedido } from '@/lib/db';
import { precoDoPedido } from '@/lib/cupons';

/**
 * Webhook da Wiven — **a única fonte de verdade sobre pagamento** (SPEC 10.6).
 *
 * Rota separada das outras de propósito. Numa virada os gateways ficam de pé
 * ao mesmo tempo: quem comprou pelo Mercado Pago há dez minutos ainda vai
 * receber a notificação dele, e um handler só, adivinhando quem mandou o quê
 * pelo formato do corpo, é o tipo de esperteza que falha exatamente na noite
 * da migração.
 *
 * ── Por que aqui o corpo é usado, e na Cakto não era ──────────────────────
 *
 * O webhook da Cakto é magro e a gente reconsulta a API para saber o status
 * de verdade. Aqui isso não dá, por duas razões que se somam:
 *
 *   1. a Wiven tem um item de documentação chamado **"Polling bloqueado"** —
 *      consultar em resposta a cada notificação é justamente o padrão que
 *      eles desencorajam
 *   2. o corpo dela é gordo: status, valor, líquido, método, `payedAt` e o
 *      `endToEndId` do Pix vêm todos ali
 *
 * Então o corpo é usado — e por isso ele passa por **duas** portas, não uma.
 */

/**
 * Comparação em tempo constante, tolerando tamanhos diferentes.
 *
 * `timingSafeEqual` **lança** quando os buffers têm tamanhos diferentes, e
 * deixar a exceção subir devolveria 500 no lugar de 401 — além de vazar, pela
 * própria diferença de resposta, que o tamanho não bate. Um `===` vazaria
 * pelo tempo quantos caracteres iniciais estavam certos, o bastante para
 * descobrir o token caractere a caractere.
 */
function tokenConfere(recebido: unknown, esperado: string): boolean {
  if (typeof recebido !== 'string') return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const esperado = tokenDoWebhook();

  if (!esperado) {
    // Sem token não há como distinguir a Wiven de qualquer um na internet. O
    // corpo é a única credencial que existe — isto não é "aceitável em dev".
    console.error('[webhook/wiven] WIVEN_WEBHOOK_TOKEN ausente — recusando tudo');
    return NextResponse.json({ erro: 'não configurado' }, { status: 401 });
  }

  let corpo: CorpoWebhookWiven;
  try {
    corpo = (await req.json()) as CorpoWebhookWiven;
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  /* Porta 1: o token. */
  if (!tokenConfere(corpo?.token, esperado)) {
    /**
     * O diagnóstico que faltava na primeira noite.
     *
     * "token não confere" sozinho não distingue as três causas possíveis:
     * corpo sem token nenhum, token de OUTRA origem (a Wiven entrega o mesmo
     * evento no webhook do painel e no `callbackUrl` da transação, e não é
     * óbvio que os dois carreguem a mesma credencial), ou o token certo com
     * espaço sobrando de quando foi colado no `.env`.
     *
     * Então vai o bastante para separar os três — **tamanho e evento, nunca
     * o valor**. Um token inteiro no log é um token vazado: log roda para
     * arquivo, arquivo entra em backup, e backup sai da máquina.
     */
    const recebido = corpo?.token;
    console.warn(
      `[webhook/wiven] token não confere — evento=${corpo?.event ?? '?'} ` +
        `recebido=${typeof recebido === 'string' ? `${recebido.length} chars` : typeof recebido} ` +
        `esperado=${esperado.length} chars ` +
        `transacao=${corpo?.transaction?.id ?? '?'}`
    );
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const resultado = traduzirWebhook(corpo);

  console.log(
    `[webhook/wiven] ${corpo.event ?? '?'} → ${resultado.status} ` +
      `transacao=${resultado.idExterno} pedido=${resultado.referenciaExterna ?? '(sem identifier)'}`
  );

  if (!resultado.idExterno) {
    // Sem id não há o que processar, e retentar não muda nada — a Wiven
    // reenviaria a mesma coisa à toa.
    return NextResponse.json({ ok: true });
  }

  /**
   * Porta 2: o valor bate com o que a gente cobrou?
   *
   * O token é um segredo compartilhado que viaja em texto no corpo, a cada
   * notificação. Se ele vazar, um POST forjado libera acesso — e a defesa
   * natural (reconsultar a API) está fora de alcance aqui.
   *
   * Então o pedido é relido do NOSSO banco e o preço, recalculado do NOSSO
   * lado. Uma notificação dizendo que o pedido foi pago com um centavo é
   * recusada.
   *
   * Aceita a MAIS de propósito: `precoComDesconto` arredonda para cima, e um
   * centavo de divergência não pode custar a entrega de uma venda real. Quem
   * pagou mais do que devia não está fraudando ninguém.
   */
  if (resultado.referenciaExterna && resultado.brutoCentavos !== null) {
    const pedido = buscarPedido(resultado.referenciaExterna);
    if (pedido) {
      const esperadoCentavos = precoDoPedido(pedido).finalCentavos;
      if (resultado.brutoCentavos < esperadoCentavos) {
        console.error(
          `[webhook/wiven] ⚠️  VALOR DIVERGENTE no pedido ${pedido.id}: ` +
            `cobramos ${esperadoCentavos} centavos, a notificação diz ${resultado.brutoCentavos}`
        );
        return NextResponse.json({ erro: 'valor divergente' }, { status: 400 });
      }
    }
  }

  try {
    /**
     * O `await` espera só a parte SÍNCRONA — checar status, achar o pedido,
     * gravar `pago`. A entrega roda em segundo plano de propósito: gateway
     * que corta a conexão por timeout reenvia o evento, e segurar a resposta
     * pelo tempo da geração da leitura garantiria isso.
     */
    await processarNotificacaoDePagamento(resultado);
    return NextResponse.json({ ok: true });
  } catch (erro) {
    console.error('[webhook/wiven] erro:', erro);
    // 500 faz a Wiven retentar. Melhor uma retentativa que uma venda paga
    // sem entrega.
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}
