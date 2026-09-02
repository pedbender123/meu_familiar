import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { apagarCampanha } from '../src/lib/campanhas';

/**
 * Tira do painel de campanhas o que nunca vendeu nada.
 *
 * ── O critério, e por que é este ──────────────────────────────────────────
 *
 * **Campanha sem uma única venda paga sai.** Não é o nome ("teste"), não é a
 * idade, não é ter sido criada à mão: é não ter dinheiro nenhum ligado a ela.
 *
 * Nome é péssimo critério — "Teste oficial 26 perguntas oficcial" tem uma
 * venda paga de verdade, e "Campanha teste com murilo" não tem nenhuma. Quem
 * decidisse por nome apagaria a errada.
 *
 * ── O que NUNCA é apagado ─────────────────────────────────────────────────
 *
 * Campanha com venda paga fica, mesmo velha, mesmo de teste, mesmo que o dono
 * diga que não importa. Apagá-la desliga aquelas vendas de qualquer relatório
 * de campanha para sempre, e essa é uma perda que nenhum backup de painel
 * desfaz. Se ela incomoda na lista, o lugar de resolver isso é a tela, com um
 * filtro — não o banco.
 *
 * Uso:
 *   npx tsx scripts/limpar-campanhas.ts             # mostra o que sairia
 *   npx tsx scripts/limpar-campanhas.ts --aplicar
 */

const APLICAR = process.argv.includes('--aplicar');

interface Linha {
  id: string;
  nome: string;
  utm_campanha: string | null;
  investido_centavos: number;
  pedidos: number;
  pagos: number;
  assinaturas: number;
}

const campanhas = db
  .prepare(
    `SELECT c.id, c.nome, c.utm_campanha, c.investido_centavos,
            (SELECT COUNT(*) FROM pedidos WHERE campanha_id = c.id) pedidos,
            (SELECT COUNT(*) FROM pedidos WHERE campanha_id = c.id AND pago_em IS NOT NULL) pagos,
            (SELECT COUNT(*) FROM cobrancas WHERE campanha_id = c.id AND status = 'pago') assinaturas
       FROM campanhas c ORDER BY c.inicio`
  )
  .all() as Linha[];

console.log(APLICAR ? 'MODO REAL' : 'SIMULAÇÃO — nada é apagado. Use --aplicar.');
console.log('');

for (const c of campanhas) {
  const vendas = c.pagos + c.assinaturas;
  const fica = vendas > 0;
  console.log(
    `${fica ? 'FICA  ' : 'APAGA '} ${String(c.nome).slice(0, 40).padEnd(40)} ` +
      `| pedidos: ${String(c.pedidos).padStart(3)} | vendas: ${vendas} ` +
      `| ${c.utm_campanha ? 'da Meta' : 'à mão'}`
  );

  if (!fica && APLICAR) apagarCampanha(c.id);
}

const apagadas = campanhas.filter((c) => c.pagos + c.assinaturas === 0);
console.log(
  `\n${apagadas.length} de ${campanhas.length} campanhas ${APLICAR ? 'apagadas' : 'sairiam'}.`
);

/*
  O investimento que estava nelas some junto, e isso precisa ser dito em voz
  alta: se alguém gastou de verdade naquela campanha, o gasto sai da conta do
  negócio ao apagá-la.
*/
const perdido = apagadas.reduce((s, c) => s + c.investido_centavos, 0);
if (perdido > 0) {
  console.log(
    `Atenção: R$ ${(perdido / 100).toFixed(2)} de investimento registrado sai junto — ` +
      'se esse dinheiro foi gasto mesmo, some para a campanha que herdou o tráfego.'
  );
}
