import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { campanhaDoUtm, pecaDoUtm, idDaMeta } from '../src/lib/campanhas';
import { buscarCobranca } from '../src/nucleo/cobrancas';
import { reportarAssinatura } from '../src/lib/reportar-assinatura';
import { reportarVenda } from '../src/lib/reportar-venda';
import { buscarPedido } from '../src/lib/db';

/**
 * Religa o histórico ao rastreio — o conserto do que já aconteceu.
 *
 * ── O que foi medido em produção, 01/09 ───────────────────────────────────
 *
 * 1. **Quatro campanhas da Meta chegando como sete identidades.** Três delas
 *    vinham em dois formatos ao mesmo tempo (`ID` e `Nome|ID`), então cada
 *    uma existia duas vezes na UTMify, com metade das vendas em cada.
 *
 * 2. **Três campanhas da Meta caindo dentro de UMA campanha nossa.** O link
 *    do anúncio carrega `?c=a2`, o `?c=` vencia o UTM, e a agência reusa o
 *    mesmo `?c=` em campanha nova atrás de campanha nova. As três apareciam
 *    somadas numa linha só.
 *
 * 3. **A assinatura paga sem atribuição nenhuma.** A cobrança nasceu antes de
 *    `cobrancas` ter as colunas de campanha (migração 038).
 *
 * 4. **Vendas pagas que nunca chegaram à UTMify.**
 *
 * O código novo conserta os quatro daqui para a frente. Este script conserta
 * o que já está no banco.
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
 *   npx tsx scripts/religar-utmify.ts --aplicar    # corrige o banco
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

/* ── 1. os pedidos voltam para a campanha que o UTM deles diz ─────────────*/

interface LinhaDePedido {
  id: string;
  campanha_id: string | null;
  peca_id: string | null;
  utm_json: string;
  origem: string | null;
  pago_em: string | null;
}

function reatribuirPedidos() {
  titulo('1. Pedidos na campanha errada');

  const pedidos = db
    .prepare(
      `SELECT id, campanha_id, peca_id, utm_json, origem, pago_em FROM pedidos
        WHERE exemplo = 0 AND utm_json IS NOT NULL AND length(utm_json) > 2
        ORDER BY criado_em`
    )
    .all() as LinhaDePedido[];

  const mudancas: { id: string; de: string | null; para: string; pago: boolean }[] = [];

  for (const p of pedidos) {
    let utm: Record<string, string>;
    try {
      utm = JSON.parse(p.utm_json);
    } catch {
      continue;
    }

    // Só mexe onde a Meta afirma um ID. Sem ID, o `?c=` continua mandando.
    if (!idDaMeta(utm.utm_campaign)) continue;

    const campanha = campanhaDoUtm(utm.utm_campaign, p.origem);
    if (!campanha || campanha.id === p.campanha_id) continue;

    const peca = pecaDoUtm(campanha.id, utm.utm_content, utm.utm_term, utm.utm_medium);

    mudancas.push({
      id: p.id.slice(0, 8),
      de: p.campanha_id?.slice(0, 8) ?? null,
      para: `${campanha.nome} (${campanha.id.slice(0, 8)})`,
      pago: !!p.pago_em,
    });

    if (APLICAR) {
      db.prepare(`UPDATE pedidos SET campanha_id = ?, peca_id = ? WHERE id = ?`).run(
        campanha.id,
        peca?.id ?? null,
        p.id
      );
    }
  }

  console.log(`${mudancas.length} pedidos mudam de campanha (${mudancas.filter((m) => m.pago).length} pagos)`);
  for (const m of mudancas) {
    console.log(`  ${m.id} ${m.pago ? '💰' : '  '} ${m.de ?? '(sem)'} → ${m.para}`);
  }

  /*
    O aviso que importa mais que a correção.

    O investimento é digitado à mão na campanha. Quando a receita muda de
    campanha e o investimento não, o ROAS das duas fica errado — a que perdeu
    a venda parece cara, a que ganhou parece de graça. Nenhum script pode
    adivinhar como o orçamento foi dividido entre campanhas que até agora
    eram uma só.
  */
  if (mudancas.length > 0) {
    console.log(
      '\n  ATENÇÃO: o investimento continua na campanha antiga. Redistribua à\n' +
        '  mão no painel, senão o ROAS das duas fica errado — a que perdeu a\n' +
        '  venda parece cara e a que ganhou parece de graça.'
    );
  }
}

/* ── 2. a assinatura herda a atribuição do pedido que a originou ──────────*/

function atribuirCobrancas() {
  titulo('2. Cobranças pagas sem atribuição');

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

/* ── 3. o que está pago e nunca chegou à UTMify ───────────────────────────*/

async function reportarAtrasadas() {
  titulo('3. Vendas pagas não reportadas à UTMify');

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
  for (const c of cobrancas) {
    const x = buscarCobranca(c.id)!;
    await reportarAssinatura(x, 'paid');
    console.log(`  ✓ assinatura ${x.id.slice(0, 8)} · ${x.email}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  for (const p of pedidos) {
    const x = buscarPedido(p.id)!;
    await reportarVenda(x, 'paid');
    console.log(`  ✓ pedido ${x.id.slice(0, 8)} · ${x.email}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function principal() {
  console.log(
    APLICAR
      ? `MODO REAL${ENVIAR ? ' + ENVIO À UTMIFY' : ' (sem enviar nada)'}` +
          (COM_TESTES ? ' · INCLUINDO TESTES DO DONO' : '')
      : 'SIMULAÇÃO — nada é alterado. Use --aplicar para valer.'
  );
  reatribuirPedidos();
  atribuirCobrancas();
  await reportarAtrasadas();
  console.log('');
}

principal();
