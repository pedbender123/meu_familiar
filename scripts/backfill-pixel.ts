import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

// Importado pelo efeito colateral: garante que `pixel_capi_em` já existe
// antes da primeira query. Ver src/lib/db.ts.
import '../src/lib/db';
import Database from 'better-sqlite3';
import { BANCO } from '../src/lib/caminhos';
import { produtoDe } from '../src/lib/produtos';
import { enviarEventoCapi } from '../src/lib/capi';

/**
 * Manda Purchase (e InitiateCheckout, quando dá pra saber quando aconteceu)
 * atrasado pro Meta via Conversions API — pra vendas que já foram cobradas
 * de verdade mas nunca dispararam o pixel no navegador.
 *
 * ── Por que isso existia ──────────────────────────────────────────────────
 *
 * Purchase só disparava quando a dona do pedido, LOGADA, visitava
 * `/revelacao/[id]` — e não existe login automático depois de pagar. Corrigido
 * em `obrigado/[id]/page.tsx` para vendas NOVAS (ver commit), mas isso não
 * ajuda o que já vendeu antes do conserto. Este script é o backfill pontual
 * para esse histórico.
 *
 * ── Janela de 7 dias ───────────────────────────────────────────────────────
 *
 * A Meta recusa evento com `event_time` mais velho que 7 dias no Conversions
 * API padrão (`action_source: website`). Pedido mais antigo que isso não tem
 * conserto por aqui — fica de fora silenciosamente, não é bug.
 *
 * ── Por que o padrão é NÃO enviar ─────────────────────────────────────────
 *
 * Isto manda dado de venda de verdade pra um sistema de terceiro que decide
 * como gastar dinheiro de anúncio. Errar aqui não quebra o site, mas pode
 * distorcer a otimização da campanha por dias. Ao contrário dos outros
 * scripts deste projeto (que simulam com `--simular`), este só manda de
 * verdade com `--enviar` explícito. Sem a flag, só mostra o que faria.
 *
 * Uso:
 *   npx tsx scripts/backfill-pixel.ts                # mostra o plano, não envia
 *   npx tsx scripts/backfill-pixel.ts --enviar        # envia de verdade
 *   npx tsx scripts/backfill-pixel.ts --desde=2026-08-08 --enviar
 *
 * ── Modo campanha ──────────────────────────────────────────────────────────
 *
 *   npx tsx scripts/backfill-pixel.ts --campanha=<id> [--enviar]
 *
 * Escopo trocado: em vez de todo pedido pago recente, olha só quem tocou
 * ESTA campanha (via `toques.campanha_id`) — e manda `InitiateCheckout` para
 * TODO MUNDO que abriu o checkout, mesmo quem não comprou. É o que faz o
 * algoritmo aprender "esse tipo de clique chega perto de comprar", não só
 * "esse tipo de clique compra" — sinal mais raro e mais lento de acumular.
 */
const db = new Database(BANCO);
const enviarDeVerdade = process.argv.includes('--enviar');
const argDesde = process.argv.find((a) => a.startsWith('--desde='));
const argExcluir = process.argv.find((a) => a.startsWith('--excluir='));
const argCampanha = process.argv.find((a) => a.startsWith('--campanha='))?.split('=')[1];
// E-mails a pular — tipicamente o seu próprio, usado pra testar o checkout.
// Sem isto, compra de teste vira "venda real" no Ads Manager e distorce a
// otimização da campanha com dinheiro que nunca existiu.
const emailsExcluidos = new Set(
  (argExcluir?.split('=')[1] ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
);

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
const corteMeta = new Date(Date.now() - SETE_DIAS_MS);
const corteArg = argDesde ? new Date(argDesde.split('=')[1]) : null;
const corte = corteArg && corteArg > corteMeta ? corteArg : corteMeta;

if (argCampanha) {
  processarCampanha(argCampanha).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  processarRecentes();
}

interface PedidoDoVisitante {
  id: string;
  email: string;
  produto: string;
  status: string;
  bruto_centavos: number | null;
  pago_em: string | null;
  criado_em: string;
  pixel_capi_em: string | null;
}

async function processarCampanha(campanhaId: string) {
  const visitantes = db
    .prepare(
      'SELECT DISTINCT visitante FROM toques WHERE campanha_id = ? AND visitante IS NOT NULL'
    )
    .all(campanhaId) as { visitante: string }[];

  if (visitantes.length === 0) {
    console.log(`Nenhum toque encontrado pra campanha ${campanhaId}.`);
    return;
  }

  console.log(
    `${visitantes.length} visitante(s) tocaram a campanha ${campanhaId}.` +
      (enviarDeVerdade ? '' : ' (modo simulação — rode com --enviar pra mandar de verdade)')
  );

  let enviados = 0;
  let falhas = 0;

  for (const { visitante } of visitantes) {
    const pedido = db
      .prepare(
        `SELECT id, email, produto, status, bruto_centavos, pago_em, criado_em, pixel_capi_em
           FROM pedidos WHERE visitante = ? AND exemplo = 0
           ORDER BY criado_em DESC LIMIT 1`
      )
      .get(visitante) as PedidoDoVisitante | undefined;

    if (!pedido || emailsExcluidos.has(pedido.email?.toLowerCase() ?? '')) continue;
    if (pedido.pixel_capi_em) {
      console.log(`- ${visitante} · já mandado antes (pulando)`);
      continue;
    }

    const checkoutAberto = db
      .prepare(
        `SELECT criado_em FROM marcos
          WHERE visitante = ? AND marco = 'checkout_aberto'
          ORDER BY criado_em ASC LIMIT 1`
      )
      .get(visitante) as { criado_em: string } | undefined;

    const comprou = ['pago', 'gerando', 'entregue'].includes(pedido.status);
    const valorEmReais =
      (pedido.bruto_centavos ?? produtoDe(pedido.produto).precoCentavos) / 100;

    console.log(
      `- ${visitante} · pedido ${pedido.id} · ${pedido.email || '(sem e-mail)'} ·` +
        (checkoutAberto ? ` abriu checkout em ${checkoutAberto.criado_em}` : ' não abriu checkout') +
        (comprou ? ` · COMPROU (R$ ${valorEmReais.toFixed(2)})` : ' · não comprou')
    );

    if (!enviarDeVerdade) continue;

    let algumSucesso = false;

    if (checkoutAberto) {
      const r = await enviarEventoCapi({
        nome: 'InitiateCheckout',
        quando: new Date(checkoutAberto.criado_em),
        email: pedido.email || null,
        valorEmReais,
        eventId: `${pedido.id}:checkout`,
      });
      if (r.ok) algumSucesso = true;
      else console.warn(`  InitiateCheckout falhou: ${r.erro}`);
    }

    if (comprou) {
      const r = await enviarEventoCapi({
        nome: 'Purchase',
        quando: new Date(pedido.pago_em ?? pedido.criado_em),
        email: pedido.email || null,
        valorEmReais,
        eventId: `${pedido.id}:purchase`,
      });
      if (r.ok) algumSucesso = true;
      else console.warn(`  Purchase falhou: ${r.erro}`);
    }

    if (algumSucesso) {
      db.prepare('UPDATE pedidos SET pixel_capi_em = ? WHERE id = ?').run(
        new Date().toISOString(),
        pedido.id
      );
      enviados++;
    } else if (checkoutAberto || comprou) {
      falhas++;
    }
  }

  if (enviarDeVerdade) {
    console.log(`\nenviados: ${enviados} · falhas: ${falhas}`);
  }
}

interface Linha {
  id: string;
  email: string;
  produto: string;
  status: string;
  bruto_centavos: number | null;
  desconto_percentual: number | null;
  pago_em: string | null;
  criado_em: string;
  pixel_capi_em: string | null;
}

function processarRecentes() {
  const pedidos = db
    .prepare(
      `SELECT id, email, produto, status, bruto_centavos, desconto_percentual,
              pago_em, criado_em, pixel_capi_em
         FROM pedidos
        WHERE exemplo = 0
          AND status IN ('pago', 'gerando', 'entregue')
          AND pixel_capi_em IS NULL
          AND COALESCE(pago_em, criado_em) >= ?
        ORDER BY criado_em ASC`
    )
    .all(corte.toISOString())
    .filter((p) => !emailsExcluidos.has((p as Linha).email.toLowerCase())) as Linha[];

  console.log(
    `${pedidos.length} pedido(s) pago(s) desde ${corte.toISOString()} sem CAPI enviado.` +
      (enviarDeVerdade ? '' : ' (modo simulação — rode com --enviar pra mandar de verdade)')
  );

  processar(pedidos);
}

async function processar(pedidos: Linha[]) {
  let enviados = 0;
  let falhas = 0;

  for (const p of pedidos) {
    const quandoComprou = new Date(p.pago_em ?? p.criado_em);
    const valorEmReais =
      (p.bruto_centavos ?? produtoDe(p.produto).precoCentavos) / 100;

    // Cupom 100%: nasceu já pago, nunca passou pela tela de checkout de
    // verdade — mandar InitiateCheckout aqui inventaria um passo que não
    // aconteceu.
    const passouPeloCheckout = (p.desconto_percentual ?? 0) < 100;

    console.log(
      `- ${p.id} · ${p.email} · R$ ${valorEmReais.toFixed(2)} · comprou em ${quandoComprou.toISOString()}`
    );

    if (!enviarDeVerdade) continue;

    let algumSucesso = false;

    if (passouPeloCheckout) {
      const rCheckout = await enviarEventoCapi({
        nome: 'InitiateCheckout',
        // Aproximação: o checkout abre logo depois do pedido nascer, não há
        // timestamp exato guardado pra este passo específico.
        quando: new Date(p.criado_em),
        email: p.email,
        valorEmReais,
        eventId: `${p.id}:checkout`,
      });
      if (rCheckout.ok) algumSucesso = true;
      else console.warn(`  InitiateCheckout falhou: ${rCheckout.erro}`);
    }

    const rCompra = await enviarEventoCapi({
      nome: 'Purchase',
      quando: quandoComprou,
      email: p.email,
      valorEmReais,
      eventId: `${p.id}:purchase`,
    });
    if (rCompra.ok) algumSucesso = true;
    else console.warn(`  Purchase falhou: ${rCompra.erro}`);

    if (algumSucesso) {
      db.prepare(
        'UPDATE pedidos SET pixel_capi_em = ? WHERE id = ?'
      ).run(new Date().toISOString(), p.id);
      enviados++;
    } else {
      falhas++;
    }
  }

  if (enviarDeVerdade) {
    console.log(`\nenviados: ${enviados} · falhas: ${falhas}`);
  }
}
