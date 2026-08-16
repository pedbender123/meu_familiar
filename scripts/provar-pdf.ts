/**
 * Gera um PDF de prova a partir de um pedido já entregue, sem tocar em nada.
 *
 *   npx tsx scripts/provar-pdf.ts                  → o último pedido entregue
 *   npx tsx scripts/provar-pdf.ts <pedidoId>       → esse pedido
 *   npx tsx scripts/provar-pdf.ts <id> --completa  → força as páginas da Completa
 *
 * A flag `--completa` existe porque a Completa é onde estão os gráficos e a
 * leitura de 6 parágrafos — e ela é justamente a que quase nunca tem exemplo
 * no banco local, já que o teste de compra de verdade acontece na VPS. Ela
 * sintetiza o perfil e dobra a leitura só para a prova visual.
 *
 * Escreve em `var/storage/orders/<id>/revelacao.pdf`, o mesmo caminho da
 * geração real — reprocessar o pedido sobrescreve com o conteúdo verdadeiro.
 */
import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import db from '../src/lib/db';
import { FAMILIARES, type FamiliarId, type LuaId } from '../src/lib/familiares';
import { gerarPdf } from '../src/lib/pdf';
import { produtoDe } from '../src/lib/produtos';
import { afinidades, ANGULO_DO_FAMILIAR } from '../src/lib/quiz/circulo';
import type { Leitura } from '../src/lib/leitura';
import fs from 'fs';

const args = process.argv.slice(2);
const forcarCompleta = args.includes('--completa');
const id = args.find((a) => !a.startsWith('--'));

const pedido = id
  ? db.prepare('SELECT * FROM pedidos WHERE id = ?').get(id)
  : db
      .prepare(
        `SELECT * FROM pedidos
         WHERE status = 'entregue' AND leitura_json IS NOT NULL
         ORDER BY atualizado_em DESC LIMIT 1`
      )
      .get();

if (!pedido) {
  console.error('Nenhum pedido entregue encontrado.');
  process.exit(1);
}

const p = pedido as Record<string, string | null>;
const produto = produtoDe(forcarCompleta ? 'completa' : (p.produto as string));
const familiarId = p.familiar as FamiliarId;
const leitura = JSON.parse(p.leitura_json as string) as Leitura;

let perfil = p.perfil_json ? JSON.parse(p.perfil_json) : null;

if (forcarCompleta) {
  // Ancorado no ângulo do próprio familiar, deslocado 7° — é como um perfil
  // real se parece: perto do seu bicho, não exatamente em cima dele.
  const angulo = (ANGULO_DO_FAMILIAR[familiarId] + 7 + 360) % 360;
  perfil = {
    angulo,
    magnitude: 1.4,
    eixos: { agencia: 1.1, comunhao: -0.6, abertura: 1.9, estabilidade: -2.4 },
    afinidades: afinidades(angulo),
  };
  while (leitura.leitura.length < 6) {
    leitura.leitura.push(...leitura.leitura.slice(0, 3));
  }
  leitura.leitura = leitura.leitura.slice(0, 6);
}

gerarPdf(p.id as string, {
  nome: p.nome as string,
  familiar: FAMILIARES[familiarId],
  lua: p.lua as LuaId,
  leitura,
  signoSol: p.signo_sol,
  signoLua: p.signo_lua,
  perfil: produto.graficos ? perfil : null,
}).then((caminho) => {
  const kb = Math.round(fs.statSync(caminho).size / 1024);
  console.log(`${produto.nome} · ${familiarId} · ${p.id}`);
  console.log(`${caminho} — ${kb} kB`);
});
