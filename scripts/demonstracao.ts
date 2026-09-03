import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import { randomUUID } from 'crypto';
import db, { criarPedido, atualizarPedido, buscarPedido } from '../src/lib/db';
import { ITENS } from '../src/lib/quiz/itens';
import { pontuar, type Respostas } from '../src/lib/quiz/pontuacao';
import { processarPedido } from '../src/lib/processar';
import { criarTokenMagico, garantirConta } from '../src/lib/autenticacao';
import { desbloquear } from '../src/nucleo/biblioteca/desbloqueios';
import { DIAS_DE_CARENCIA } from '../src/nucleo/carencia';

/**
 * A conta de demonstração — o que o time de marketing abre para ver o produto.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * A plataforma só mostra o que a pessoa comprou, e é isso que a torna difícil
 * de APRESENTAR: uma conta nova é uma casa de cômodos trancados. Quem precisa
 * avaliar a tela da revelação, o leitor de livro e o rádio não vai fazer um
 * ritual de treze minutos e uma compra a cada vez.
 *
 * Ela monta uma conta com tudo aceso de uma vez: uma revelação de verdade
 * (passa pelo mesmo pipeline do produto, com Gemini, artes e PDF) e os três
 * livros — cada um num estado diferente, de propósito, para a apresentação
 * mostrar a regra dos sete dias sem precisar esperar sete dias.
 *
 * ── Nunca em produção ─────────────────────────────────────────────────────
 *
 * Ela cria um pedido pago que ninguém pagou. No banco de produção isso é um
 * número errado no faturamento do dia e uma linha falsa na campanha. A trava
 * é o `BASE_URL`: se ele aponta para o domínio de verdade, o script recusa.
 *
 * Uso:  npx tsx scripts/demonstracao.ts [--email alguem@dominio.com]
 */

const EMAIL_PADRAO = 'demonstracao@bruxario.com.br';
const UM_DIA = 86_400_000;

function alvoProibido(): boolean {
  const base = (process.env.BASE_URL || '').toLowerCase();
  return /^https?:\/\/(www\.)?bruxario\.com\.br/.test(base);
}

function respostasSorteadas(): Respostas {
  const r: Respostas = {};
  for (const item of ITENS) r[item.id] = Math.floor(Math.random() * 4);
  return r;
}

async function main() {
  if (alvoProibido()) {
    console.error(
      'BASE_URL aponta para produção. Esta conta cria um pedido pago que ' +
        'ninguém pagou — ela existe só para teste.'
    );
    process.exit(1);
  }

  const i = process.argv.indexOf('--email');
  const email = (i > -1 ? process.argv[i + 1] : EMAIL_PADRAO).trim().toLowerCase();

  /* ── a revelação ──────────────────────────────────────────────────── */
  const jaTem = db
    .prepare(
      `SELECT id FROM pedidos WHERE lower(email) = ? AND status = 'entregue'
        ORDER BY criado_em DESC LIMIT 1`
    )
    .get(email) as { id: string } | undefined;

  let pedidoId = jaTem?.id;

  if (pedidoId) {
    console.log(`revelação que já existia: ${pedidoId}`);
  } else {
    pedidoId = randomUUID();
    const respostas = respostasSorteadas();
    const nascimento = '1992-06-14';
    const { calcularSignos, calcularFaseDaLua } = await import('../src/lib/astro');
    const { signoSol, signoLua } = calcularSignos(nascimento, '12:00');
    const pontos = pontuar(respostas);

    criarPedido({
      id: pedidoId,
      nome: 'Marina',
      email,
      respostas_json: JSON.stringify({ quiz: respostas, dataNascimento: nascimento }),
      familiar: pontos.familiar,
      lua: calcularFaseDaLua(nascimento, '12:00'),
      signo_sol: signoSol,
      signo_lua: signoLua,
      // A Completa: é a que tem gráficos e narração, e apresentação se faz
      // com o produto inteiro à mostra.
      produto: 'completa',
      perfil_json: JSON.stringify({
        eixos: pontos.normalizado,
        bruto: pontos.bruto,
        angulo: pontos.angulo,
        magnitude: pontos.magnitude,
        afinidades: pontos.afinidades,
        empate: pontos.empate,
      }),
    });

    /**
     * Paga há oito dias.
     *
     * Não é enfeite: é o que faz o botão de guardar o PDF aparecer. Com a
     * data de hoje, a tela mostraria "fica pronto em 7 dias" — verdade no
     * produto, inútil numa demonstração que precisa mostrar o botão.
     */
    const oitoDiasAtras = new Date(Date.now() - (DIAS_DE_CARENCIA + 1) * UM_DIA);
    atualizarPedido(pedidoId, {
      status: 'pago',
      pago_em: oitoDiasAtras.toISOString(),
      bruto_centavos: 2490,
      ritual_completo: 1,
      cenas_respondidas: ITENS.length,
      expira_em: null,
    });

    console.log('gerando a revelação (Gemini, artes, PDF)...');
    await processarPedido(pedidoId);
    console.log(`  → ${buscarPedido(pedidoId)?.status}`);
  }

  /* ── os livros, um em cada estado ─────────────────────────────────── */
  garantirConta(email);

  const estantes: {
    ebookId: string;
    origem: 'bump' | 'cortesia';
    diasAtras: number;
    conta: string;
  }[] = [
    { ebookId: 'magia-elemental', origem: 'bump', diasAtras: 9, conta: 'comprado — com o PDF já liberado' },
    { ebookId: 'ler-o-futuro', origem: 'bump', diasAtras: 0, conta: 'comprado hoje — o PDF ainda em carência' },
    { ebookId: 'terceiro-olho', origem: 'cortesia', diasAtras: 30, conta: 'aberto sem compra — lê e não baixa' },
  ];

  for (const linha of estantes) {
    db.prepare('DELETE FROM desbloqueios WHERE email = ? AND ebook_id = ?').run(
      email,
      linha.ebookId
    );
    desbloquear({
      email,
      ebookId: linha.ebookId,
      origem: linha.origem,
      quando: new Date(Date.now() - linha.diasAtras * UM_DIA),
      precoCentavos: 0,
    });
    console.log(`  ${linha.ebookId.padEnd(18)} ${linha.conta}`);
  }

  /* ── a porta ──────────────────────────────────────────────────────── */
  const base = process.env.BASE_URL || 'http://localhost:3000';

  /**
   * Três links, e não um.
   *
   * O link mágico morre ao ser usado — é o que impede um e-mail encaminhado de
   * virar acesso permanente, e vale igual aqui. Numa apresentação isso é um
   * problema real: a pessoa abre no computador, quer conferir no celular, e o
   * segundo clique diz "expirado". Três resolve a demonstração inteira sem
   * afrouxar a regra; para mais, é rodar o script de novo.
   */
  console.log('\nentrar — cada link serve UMA vez, e vale 7 dias:');
  for (let n = 1; n <= 3; n++) {
    const token = criarTokenMagico(email, 'conta', 60 * 24 * 7);
    console.log(`  ${n}. ${base}/entrar/verificar?t=${encodeURIComponent(token)}`);
  }
  console.log(`\nrevelação pública: ${base}/revelacao/${pedidoId}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
