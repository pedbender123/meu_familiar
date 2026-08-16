import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

// Importado pelo efeito colateral: é o boot deste módulo que cria as tabelas
// e as colunas novas. Sem ele o script abre um banco ainda sem `atribuicao`.
import '../src/lib/db';
import Database from 'better-sqlite3';
import { BANCO } from '../src/lib/caminhos';

/**
 * Traz o histórico para o esquema de rastreio novo, **sem inventar dado**.
 *
 * ── O que dá para recuperar, e o que não dá ───────────────────────────────
 *
 * Os pedidos antigos têm `origem` (o canal, do cookie `bx_de`) e mais nada.
 * Campanha e peça não existiam, então não há como saber qual vídeo trouxe
 * quem — e preencher isso com um chute contaminaria justamente o relatório
 * que estamos consertando. Eles ficam com `atribuicao = 'legado'`, que é a
 * verdade: sabemos o canal, não sabemos a peça.
 *
 * As VISITAS antigas viram toques, porque delas dá para derivar tipo e se
 * contam como aquisição a partir da origem que já está gravada. É o que
 * permite a jornada mostrar algo para quem chegou antes de hoje.
 *
 * Idempotente: rodar duas vezes não duplica nada.
 *
 * Uso:  npx tsx scripts/migrar-rastreio.ts [--simular]
 */
const db = new Database(BANCO);
const secos = process.argv.includes('--simular');

function tipoDaOrigem(origem: string | null): {
  tipo: string;
  conta: number;
} {
  if (!origem) return { tipo: 'direto', conta: 1 };
  if (origem === 'email') return { tipo: 'email', conta: 0 };
  if (origem === 'remarketing') return { tipo: 'remarketing', conta: 1 };
  if (origem === 'compartilhamento') return { tipo: 'compartilhamento', conta: 1 };
  if (origem === 'direto' || origem === 'outro') return { tipo: 'direto', conta: 1 };
  return { tipo: 'social', conta: 1 };
}

/* ── 1. pedidos antigos ganham a marca de legado ───────────────────────── */

const semAtribuicao = db
  .prepare('SELECT count(*) n FROM pedidos WHERE atribuicao IS NULL')
  .get() as { n: number };

console.log(`pedidos sem atribuição: ${semAtribuicao.n}`);
if (!secos && semAtribuicao.n > 0) {
  db.prepare(
    `UPDATE pedidos SET atribuicao = 'legado' WHERE atribuicao IS NULL`
  ).run();
  console.log(`  marcados como 'legado' (canal conhecido, peça desconhecida)`);
}

/* ── 2. visitas viram toques ───────────────────────────────────────────── */

const jaTem = (db.prepare('SELECT count(*) n FROM toques').get() as { n: number }).n;
console.log(`\ntoques já existentes: ${jaTem}`);

if (jaTem > 0) {
  console.log('  já migrado — nada a fazer');
} else {
  /**
   * Uma visita por pessoa por dia por origem vira um toque.
   *
   * A tabela de visitas tem uma linha por PÁGINA vista; transformar cada uma
   * em toque encheria a jornada de ruído e faria dez páginas navegadas
   * parecerem dez chegadas. O agrupamento por dia é a aproximação honesta do
   * que o dado antigo permite dizer.
   */
  const visitas = db
    .prepare(
      `SELECT visitante, origem, referencia,
              min(criado_em) AS criado_em,
              min(caminho)  AS caminho
         FROM visitas
        GROUP BY visitante, date(criado_em), origem
        ORDER BY criado_em`
    )
    .all() as {
    visitante: string;
    origem: string | null;
    referencia: string | null;
    criado_em: string;
    caminho: string;
  }[];

  console.log(`  visitas agrupadas em ${visitas.length} toque(s)`);
  const porTipo = new Map<string, number>();
  for (const v of visitas) {
    const { tipo } = tipoDaOrigem(v.origem);
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
  }
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(18)} ${n}`);
  }

  if (!secos) {
    const inserir = db.prepare(
      `INSERT INTO toques
         (visitante, tipo, origem, campanha_id, peca_id, indicado_por,
          conta_aquisicao, caminho, referencia, criado_em)
       VALUES (@visitante, @tipo, @origem, NULL, NULL, NULL,
          @conta, @caminho, @referencia, @criado_em)`
    );
    const emLote = db.transaction((linhas: typeof visitas) => {
      for (const v of linhas) {
        const { tipo, conta } = tipoDaOrigem(v.origem);
        inserir.run({ ...v, tipo, conta });
      }
    });
    emLote(visitas);
    console.log(`  ${visitas.length} toque(s) gravados`);
  }
}

console.log(secos ? '\nSIMULAÇÃO — nada foi gravado.' : '\nPronto.');
