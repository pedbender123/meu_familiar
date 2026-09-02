import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { buscarCobranca } from '../src/nucleo/cobrancas';
import { reportarAssinatura } from '../src/lib/reportar-assinatura';
import { reportarVenda } from '../src/lib/reportar-venda';
import { buscarPedido } from '../src/lib/db';

/**
 * Religa o histórico ao rastreio — o conserto do que já aconteceu.
 *
 * ── O que ele conserta ────────────────────────────────────────────────────
 *
 * 1. **A assinatura paga sem atribuição nenhuma.** A cobrança nasceu antes de
 *    `cobrancas` ter as colunas de campanha (migração 038), então ela não
 *    aparecia como venda em campanha nenhuma.
 *
 * 2. **Vendas pagas que nunca chegaram à UTMify.**
 *
 * ── O que ele NÃO faz, e não deve voltar a fazer ──────────────────────────
 *
 * Uma versão anterior reatribuía os pedidos às campanhas do gerenciador de
 * anúncios, criando uma campanha nossa para cada `utm_campaign` da Meta.
 * Isso está errado por confundir duas coisas com o mesmo nome: **campanha no
 * painel é recorte interno do funil**, montado por quem faz o link, e não um
 * espelho do gerenciador. O efeito foi encher a tela de linhas com nome de
 * número e quebrar a leitura que o dono usa.
 *
 * O que a UTMify recebe não depende disso: vai o `utm_json` cru do pedido.
 *
 * ── Isto NÃO inventa histórico ────────────────────────────────────────────
 *
 * Cada correção sai de evidência que já estava gravada na própria linha: o
 * `utm_json` do pedido diz de qual campanha da Meta ele veio, e o pedido do
 * mesmo e-mail minutos antes da cobrança diz de onde o assinante veio. Nada
 * aqui é estimado, distribuído ou arredondado.
 *
 * ── Por que o padrão é não fazer nada ─────────────────────────────────────
 *
 * A parte 3 reescreve atribuição de vendas já registradas, e a parte 4 manda
 * venda para um sistema de terceiro que decide gasto de anúncio. Sem flag,
 * só mostra o plano.
 *
 * Uso:
 *   npx tsx scripts/religar-utmify.ts              # mostra o plano
 *   npx tsx scripts/religar-utmify.ts --aplicar    # corrige a atribuição
 *   npx tsx scripts/religar-utmify.ts --aplicar --enviar   # e reporta à UTMify
 *
 *   --so-assinaturas   manda só assinatura, nenhum pedido
 *   --com-testes       inclui as compras de teste do próprio dono (não faça)
 */

const APLICAR = process.argv.includes('--aplicar');
const ENVIAR = process.argv.includes('--enviar');
const SO_ASSINATURAS = process.argv.includes('--so-assinaturas');
const COM_TESTES = process.argv.includes('--com-testes');

/**
 * Os e-mails que não são clientes.
 *
 * ── Por que isto precisou existir ─────────────────────────────────────────
 *
 * Das 30 vendas pagas que nunca chegaram à UTMify, **14 eram testes do
 * próprio dono** — ele comprando do próprio site para conferir o funil. Elas
 * estão pagas de verdade no banco, e por isso o script as encontrava junto
 * com as reais.
 *
 * Mandá-las seria pior que não mandar nada: além de inflar o relatório da
 * agência com receita que não existe, cada uma vira um `Purchase` na Meta
 * pela integração deles — o mesmo caminho que inflou o contador para 17 em
 * agosto. A campanha passaria a otimizar por compras que ninguém fez.
 *
 * O padrão é excluir. `--com-testes` força a inclusão, para quando alguém
 * quiser conferir o caminho inteiro num ambiente de teste.
 */
const EMAILS_QUE_NAO_SAO_CLIENTES = /pedro\.p\.bender|teste-prod|@exemplo\.com/i;

function ehTeste(email: string | null | undefined): boolean {
  return !COM_TESTES && EMAILS_QUE_NAO_SAO_CLIENTES.test(email ?? '');
}

function titulo(t: string) {
  console.log(`\n${'─'.repeat(72)}\n${t}\n${'─'.repeat(72)}`);
}

/* ── 1. a assinatura herda a atribuição do pedido que a originou ──────────*/

function atribuirCobrancas() {
  titulo('1. Cobranças pagas sem atribuição');

  const cobrancas = db
    .prepare(
      `SELECT id, email, pago_em, criado_em FROM cobrancas
        WHERE status = 'pago' AND campanha_id IS NULL ORDER BY criado_em`
    )
    .all() as { id: string; email: string; pago_em: string; criado_em: string }[];

  for (const c of cobrancas) {
    /**
     * O pedido do mesmo e-mail, imediatamente ANTES da cobrança.
     *
     * É a assinatura vendida na página de oferta: a pessoa termina o ritual,
     * vê a escada e assina — medido em produção, sete minutos entre uma coisa
     * e outra. O pedido carrega campanha, peça e o `utm_json` cru.
     *
     * Antes da cobrança, e não o mais recente do e-mail: quem voltou ao site
     * depois de assinar gerou pedido novo, e esse pedido não trouxe ninguém.
     * Foi o caso do único assinante — o pedido posterior chegou por `busca`,
     * sem campanha nenhuma, e teria apagado a atribuição verdadeira.
     */
    const pedido = db
      .prepare(
        `SELECT id, campanha_id, peca_id, origem, atribuicao, utm_json, ip_comprador
           FROM pedidos
          WHERE lower(email) = ? AND criado_em <= ? AND campanha_id IS NOT NULL
          ORDER BY criado_em DESC LIMIT 1`
      )
      .get(c.email.toLowerCase(), c.pago_em) as
      | {
          id: string;
          campanha_id: string;
          peca_id: string | null;
          origem: string | null;
          atribuicao: string | null;
          utm_json: string | null;
          ip_comprador: string | null;
        }
      | undefined;

    if (!pedido) {
      console.log(`  ${c.id.slice(0, 8)} ${c.email}: sem pedido anterior — fica sem campanha`);
      continue;
    }

    console.log(
      `  ${c.id.slice(0, 8)} ${c.email}\n` +
        `      herda do pedido ${pedido.id.slice(0, 8)} · campanha ${pedido.campanha_id.slice(0, 8)}` +
        ` · ${pedido.utm_json ?? 'sem utm'}`
    );

    if (APLICAR) {
      db.prepare(
        `UPDATE cobrancas SET campanha_id = @campanha, peca_id = @peca, origem = @origem,
              atribuicao = @atribuicao, utm_json = @utm, ip_comprador = @ip
          WHERE id = @id`
      ).run({
        id: c.id,
        campanha: pedido.campanha_id,
        peca: pedido.peca_id,
        origem: pedido.origem,
        atribuicao: pedido.atribuicao,
        utm: pedido.utm_json,
        ip: pedido.ip_comprador,
      });
    }
  }

  if (cobrancas.length === 0) console.log('  nenhuma — todas já têm campanha');
}

/* ── 2. o que está pago e nunca chegou à UTMify ───────────────────────────*/

async function reportarAtrasadas() {
  titulo('2. Vendas pagas não reportadas à UTMify');

  const cobrancas = db
    .prepare(
      `SELECT id FROM cobrancas
        WHERE status = 'pago' AND (utmify_em IS NULL OR utmify_erro IS NOT NULL)
        ORDER BY pago_em`
    )
    .all() as { id: string }[];

  const todosOsPedidos = SO_ASSINATURAS
    ? []
    : (db
        .prepare(
          `SELECT id, email FROM pedidos
            WHERE exemplo = 0 AND pago_em IS NOT NULL
              AND (utmify_em IS NULL OR utmify_erro IS NOT NULL)
            ORDER BY pago_em`
        )
        .all() as { id: string; email: string | null }[]);

  const descartados = todosOsPedidos.filter((p) => ehTeste(p.email));
  const pedidos = todosOsPedidos.filter((p) => !ehTeste(p.email));

  console.log(`  ${cobrancas.length} assinaturas · ${pedidos.length} pedidos`);
  if (descartados.length > 0) {
    console.log(
      `  ${descartados.length} pedidos de teste do próprio dono ficam de fora ` +
        '(--com-testes inclui)'
    );
  }
  if (SO_ASSINATURAS) console.log('  --so-assinaturas: nenhum pedido será enviado');

  if (!ENVIAR) {
    for (const c of cobrancas) {
      const x = buscarCobranca(c.id)!;
      console.log(`  assinatura ${x.id.slice(0, 8)} · ${x.email} · ${x.valor_centavos / 100}`);
    }
    for (const p of pedidos.slice(0, 20)) {
      const x = buscarPedido(p.id)!;
      console.log(`  pedido ${x.id.slice(0, 8)} · ${x.email} · ${x.produto}`);
    }
    if (pedidos.length > 20) console.log(`  ... e mais ${pedidos.length - 20}`);
    console.log('\n  (--enviar para mandar de verdade)');
    return;
  }

  /*
    Enviar em série, com respiro.

    A UTMify repassa cada venda para a Meta, e mandar dezenas de uma vez é o
    tipo de rajada que dispara proteção — foi o que derrubou o checkout da
    Wiven por 26 horas em 24/08. Um relatório atrasado suporta esperar.
  */
  let aceitos = 0;
  let recusados = 0;

  for (const c of cobrancas) {
    const x = buscarCobranca(c.id)!;
    /*
      O resultado é lido, não presumido. Antes disto o script imprimia ✓ para
      uma venda que a UTMify tinha recusado com 400 — a marca de certo era só
      "a função voltou sem lançar", que é uma coisa completamente diferente.
    */
    const ok = await reportarAssinatura(x, 'paid');
    console.log(`  ${ok ? '✓' : '✗'} assinatura ${x.id.slice(0, 8)} · ${x.email}`);
    ok ? aceitos++ : recusados++;
    await new Promise((r) => setTimeout(r, 1500));
  }
  for (const p of pedidos) {
    const x = buscarPedido(p.id)!;
    await reportarVenda(x, 'paid');
    /*
      `reportarVenda` grava o desfecho no próprio pedido e não devolve nada.
      Reler é mais honesto que presumir, e é a mesma fonte que a tela de
      Saúde consulta.
    */
    const depois = buscarPedido(p.id)!;
    const ok = !!depois.utmify_em && !depois.utmify_erro;
    console.log(`  ${ok ? '✓' : '✗'} pedido ${x.id.slice(0, 8)} · ${x.email}`);
    ok ? aceitos++ : recusados++;
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n  ${aceitos} aceitas · ${recusados} recusadas pela UTMify`);
  if (recusados > 0) {
    console.log('  As recusadas continuam marcadas como não reportadas, e podem ser reenviadas.');
  }
}

async function principal() {
  console.log(
    APLICAR
      ? `MODO REAL${ENVIAR ? ' + ENVIO À UTMIFY' : ' (sem enviar nada)'}` +
          (COM_TESTES ? ' · INCLUINDO TESTES DO DONO' : '')
      : 'SIMULAÇÃO — nada é alterado. Use --aplicar para valer.'
  );
  atribuirCobrancas();
  await reportarAtrasadas();
  console.log('');
}

principal();
