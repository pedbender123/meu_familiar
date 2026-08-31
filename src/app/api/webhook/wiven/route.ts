import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { appendFileSync, statSync } from 'node:fs';
import {
  tokensDoWebhook,
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

/**
 * Captação temporária, para diagnosticar o que a Wiven manda de verdade.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * Oito notificações foram recusadas por token na primeira noite, e uma
 * passou. "Token não confere" não distingue as causas: a Wiven pode estar
 * entregando o mesmo evento em dois lugares — o webhook do painel e o
 * `callbackUrl` da transação — com credenciais diferentes.
 *
 * ── Por que ela se apaga sozinha ──────────────────────────────────────────
 *
 * Diagnóstico ligado por variável de ambiente vira diagnóstico esquecido
 * ligado. Aqui a chave é um ARQUIVO, e ele vale por 15 minutos a partir da
 * própria data de modificação. Ligar é `touch`; desligar é não fazer nada.
 * Sem restart nas duas pontas.
 *
 * ── O que ela NÃO grava ───────────────────────────────────────────────────
 *
 * O token inteiro. Arquivo vira backup, backup sai da máquina. Vai o
 * suficiente para comparar duas origens — tamanho e as pontas — e nada que
 * sirva para forjar uma notificação.
 */
const ARQUIVO_LIGA = 'var/captura-wiven.ligada';
const ARQUIVO_CAPTURA = 'var/captura-wiven.jsonl';
const JANELA_MS = 15 * 60 * 1000;

function captacaoLigada(): boolean {
  try {
    return Date.now() - statSync(ARQUIVO_LIGA).mtimeMs < JANELA_MS;
  } catch {
    return false;
  }
}

/** As pontas de um segredo, para comparar origens sem poder reusá-lo. */
function pontasDe(v: unknown): string {
  if (typeof v !== 'string') return `(${typeof v})`;
  if (v.length <= 6) return `${v.length} chars, curto demais para mostrar`;
  return `${v.length} chars: ${v.slice(0, 3)}…${v.slice(-3)}`;
}

function captar(req: NextRequest, cru: string) {
  if (!captacaoLigada()) return;
  try {
    let corpo: Record<string, unknown> = {};
    try {
      corpo = JSON.parse(cru);
    } catch {
      corpo = { '(corpo não é JSON)': cru.slice(0, 2000) };
    }
    const { token, ...resto } = corpo as { token?: unknown };

    appendFileSync(
      ARQUIVO_CAPTURA,
      JSON.stringify({
        em: new Date().toISOString(),
        ip: req.headers.get('x-forwarded-for'),
        agente: req.headers.get('user-agent'),
        // Cabeçalhos que a Wiven possa usar para assinar, se um dia usar.
        cabecalhos: Object.fromEntries(
          [...req.headers.entries()].filter(([k]) => /signature|token|hmac|wiven/i.test(k))
        ),
        token: pontasDe(token),
        corpo: resto,
      }) + '\n',
      'utf8'
    );
  } catch (erro) {
    console.error('[webhook/wiven] captação falhou:', erro);
  }
}

/**
 * O diário do formato — a resposta da Fase 2, esperando a próxima venda.
 *
 * ── Por que a captação existente não serve para isto ──────────────────────
 *
 * Ela se apaga sozinha em 15 minutos, de propósito: foi feita para uma sessão
 * de diagnóstico com alguém olhando. As perguntas da Fase 2 dependem de uma
 * venda ORGÂNICA, que pode acontecer às 4 da manhã de terça.
 *
 * ── As três perguntas que ele responde ────────────────────────────────────
 *
 * `docs/PLANO-WIVEN-PRODUTOS.md` §4 (Fase 2) precisa saber, de uma venda de
 * verdade: o `offerCode` volta preenchido? veio algum campo de `products`? a
 * coprodução dividiu (aparece `commissionAmount` menor que o esperado)?
 * Nenhuma delas se responde chutando o formato do corpo — e chutar campo de
 * API de pagamento é como se derruba um checkout.
 *
 * ── O que ele grava, e o que nunca grava ──────────────────────────────────
 *
 * NOMES de campo, e só os valores de `offerCode`/`products`/`subscription`,
 * que são códigos de catálogo. Nome, e-mail, CPF e token não entram: arquivo
 * vira backup, backup sai da máquina.
 */
const ARQUIVO_FORMATO = 'var/wiven-formato.jsonl';

function anotarFormato(corpo: CorpoWebhookWiven): void {
  try {
    const t = (corpo.transaction ?? {}) as Record<string, unknown>;
    const topo = corpo as unknown as Record<string, unknown>;

    /*
      Procura NOS DOIS NÍVEIS, e isso não é excesso de zelo.

      A documentação do webhook põe `offerCode` e `checkoutUrl` no TOPO do
      corpo, irmãos de `event` e `token` — não dentro de `transaction`, que é
      onde ficam id, status e os valores. Olhar só a transação faria o diário
      registrar "não veio offerCode" para sempre, e essa resposta errada é
      pior que resposta nenhuma: ela encerraria a investigação da Fase 2 com
      uma conclusão falsa.
    */
    const interessantes = [
      'offerCode',
      'checkoutUrl',
      'products',
      'product',
      'offer',
      'subscription',
      'splits',
    ];
    const achar = (k: string) => t[k] ?? topo[k];

    appendFileSync(
      ARQUIVO_FORMATO,
      JSON.stringify({
        em: new Date().toISOString(),
        evento: corpo.event ?? null,
        // A pergunta 1: se um destes vier preenchido, a Fase 1 tem contrato.
        achados: Object.fromEntries(
          interessantes
            .filter((k) => achar(k) !== undefined && achar(k) !== null)
            .map((k) => [k, achar(k)])
        ),
        // O mapa do corpo, para ver campo novo aparecer sem precisar de sorte.
        camposDoTopo: Object.keys(corpo),
        camposDaTransacao: Object.keys(t),
        // A pergunta 2: com coprodução, este número muda sem `splits` no corpo.
        amount: t.amount ?? null,
        commissionAmount: t.commissionAmount ?? null,
      }) + '\n',
      'utf8'
    );
  } catch (erro) {
    // Um diário de diagnóstico nunca pode custar uma entrega.
    console.error('[webhook/wiven] diário do formato falhou:', erro);
  }
}

export async function POST(req: NextRequest) {
  const esperados = tokensDoWebhook();

  if (esperados.length === 0) {
    // Sem token não há como distinguir a Wiven de qualquer um na internet. O
    // corpo é a única credencial que existe — isto não é "aceitável em dev".
    // A captação ainda roda: é justamente quando não se sabe o token que se
    // precisa ver o que está chegando.
    captar(req, await req.text());
    console.error('[webhook/wiven] WIVEN_WEBHOOK_TOKEN ausente — recusando tudo');
    return NextResponse.json({ erro: 'não configurado' }, { status: 401 });
  }

  /**
   * O corpo é lido como TEXTO primeiro.
   *
   * `req.json()` direto descarta o corpo quando ele não é JSON válido — e
   * corpo que não é JSON é exatamente o que a captação precisa ver.
   */
  const cru = await req.text();
  captar(req, cru);

  let corpo: CorpoWebhookWiven;
  try {
    corpo = JSON.parse(cru) as CorpoWebhookWiven;
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  /* Porta 1: o token — qualquer um dos cadastrados. */
  if (!esperados.some((e) => tokenConfere(corpo?.token, e))) {
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
        `esperados=[${esperados.map((e) => `${e.length} chars`).join(', ')}] ` +
        `transacao=${corpo?.transaction?.id ?? '?'}`
    );
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  anotarFormato(corpo);

  const resultado = traduzirWebhook(corpo);

  /**
   * Repasse não é taxa.
   *
   * A Wiven manda `commissionAmount`: o que sobra para quem cobrou, já
   * descontados a taxa dela E os splits. `traduzirWebhook` deduz a taxa por
   * subtração, e a subtração não sabe distinguir as duas coisas — na venda de
   * 27/08 os R$ 9,44 repassados apareceram somados à taxa, que virou R$ 12,57
   * numa venda de R$ 18,90.
   *
   * O número certo está gravado no pedido desde a cobrança. Subtraí-lo devolve
   * a taxa real, e é ela que o painel financeiro e a Utmify recebem — sem
   * isso, o custo de gateway aparece como 66% da venda e o lucro da campanha
   * afunda num número que nunca existiu.
   */
  const pedidoDaVenda = resultado.referenciaExterna
    ? buscarPedido(resultado.referenciaExterna)
    : undefined;
  const splitCentavos = pedidoDaVenda?.split_centavos ?? 0;
  if (splitCentavos > 0 && resultado.taxaCentavos !== null) {
    resultado.taxaCentavos = Math.max(resultado.taxaCentavos - splitCentavos, 0);
  }

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
    const pedido = pedidoDaVenda;
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
