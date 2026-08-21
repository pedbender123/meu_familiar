import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { BANCO } from './caminhos';
import { precoDoPedido, receitaDoPedido } from './cupons';

const db = new Database(BANCO);

export { CATEGORIAS, ehCategoria } from './financeiro-tipos';
export type { Categoria, Despesa } from './financeiro-tipos';
import type { Despesa } from './financeiro-tipos';

export function listarDespesas(de?: string, ate?: string): Despesa[] {
  if (de && ate) {
    return db
      .prepare(
        `SELECT * FROM despesas WHERE ocorrido_em >= ? AND ocorrido_em < ?
          ORDER BY ocorrido_em DESC`
      )
      .all(de, ate) as Despesa[];
  }
  return db
    .prepare('SELECT * FROM despesas ORDER BY ocorrido_em DESC LIMIT 200')
    .all() as Despesa[];
}

export function criarDespesa(d: {
  descricao: string;
  categoria: string;
  valor_centavos: number;
  campanha_id?: string | null;
  ocorrido_em: string;
  nota?: string | null;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO despesas
      (id, descricao, categoria, valor_centavos, campanha_id, ocorrido_em, nota, criado_em)
     VALUES (@id, @descricao, @categoria, @valor_centavos, @campanha_id, @ocorrido_em,
       @nota, @criado_em)`
  ).run({
    id,
    campanha_id: null,
    nota: null,
    ...d,
    criado_em: new Date().toISOString(),
  });
  return id;
}

export function apagarDespesa(id: string): void {
  db.prepare('DELETE FROM despesas WHERE id = ?').run(id);
}

/* ── o consolidado ───────────────────────────────────────────────────────── */

export interface Consolidado {
  brutoCentavos: number;
  taxaCentavos: number;
  custoIaCentavos: number;
  /** Só o que foi lançado à mão — anúncio, VPS, arte. */
  despesasCentavos: number;
  /** Investido em campanhas, já contido em `despesasCentavos` quando lançado. */
  investidoEmCampanhasCentavos: number;
  lucroCentavos: number;
  vendas: number;
  ticketMedioCentavos: number;
  porCategoria: { categoria: string; centavos: number }[];
  porMes: {
    mes: string;
    brutoCentavos: number;
    taxaCentavos: number;
    custoIaCentavos: number;
    despesasCentavos: number;
    lucroCentavos: number;
    vendas: number;
  }[];
}

/**
 * O fechamento: o que entrou, o que saiu e o que sobrou.
 *
 * ── Por que a taxa NÃO é um percentual configurado ────────────────────────
 *
 * Ela vem lida da resposta do Mercado Pago, venda a venda (ver `pagamento.ts`).
 * Um percentual digitado à mão erraria por método — Pix custa uma fração do
 * que custa cartão parcelado — e o "lucro" não bateria com o extrato, que é
 * exatamente o número que este painel existe para dar.
 *
 * ── O que é estimativa, e está dito na tela ───────────────────────────────
 *
 * O custo de IA. A OpenAI cobra por token e não devolve preço na resposta;
 * `custos.ts` converte com a tabela pública e um câmbio fixo. Erra alguns
 * centavos, e a tela chama de "estimado" por isso.
 */
export function consolidado(de?: string, ate?: string): Consolidado {
  const janela = de && ate;
  const filtroPedido = janela
    ? 'AND pago_em >= @de AND pago_em < @ate'
    : '';

  const pagos = db
    .prepare(
      `SELECT produto, desconto_percentual, bruto_centavos, taxa_centavos,
              liquido_centavos, custo_ia_centavos, pago_em, criado_em
         FROM pedidos
        WHERE status = 'entregue' AND exemplo = 0 ${filtroPedido}`
    )
    .all(janela ? { de, ate } : {}) as {
    produto: string;
    desconto_percentual: number | null;
    bruto_centavos: number | null;
    taxa_centavos: number | null;
    liquido_centavos: number | null;
    custo_ia_centavos: number;
    pago_em: string | null;
    criado_em: string;
  }[];

  const despesas = listarDespesas(de, ate);

  let brutoCentavos = 0;
  let taxaCentavos = 0;
  let custoIaCentavos = 0;
  const meses = new Map<string, {
    brutoCentavos: number; taxaCentavos: number; custoIaCentavos: number;
    despesasCentavos: number; lucroCentavos: number; vendas: number;
  }>();

  const mesDe = (iso: string) => iso.slice(0, 7);
  const pegarMes = (m: string) => {
    if (!meses.has(m)) {
      meses.set(m, {
        brutoCentavos: 0, taxaCentavos: 0, custoIaCentavos: 0,
        despesasCentavos: 0, lucroCentavos: 0, vendas: 0,
      });
    }
    return meses.get(m)!;
  };

  for (const p of pagos) {
    const bruto = receitaDoPedido(p);
    const taxa = p.taxa_centavos ?? 0;
    const ia = p.custo_ia_centavos ?? 0;
    brutoCentavos += bruto;
    taxaCentavos += taxa;
    custoIaCentavos += ia;

    const m = pegarMes(mesDe(p.pago_em ?? p.criado_em));
    m.brutoCentavos += bruto;
    m.taxaCentavos += taxa;
    m.custoIaCentavos += ia;
    m.vendas += 1;
  }

  let despesasCentavos = 0;
  let investidoEmCampanhasCentavos = 0;
  const categorias = new Map<string, number>();
  for (const d of despesas) {
    despesasCentavos += d.valor_centavos;
    if (d.campanha_id) investidoEmCampanhasCentavos += d.valor_centavos;
    categorias.set(d.categoria, (categorias.get(d.categoria) ?? 0) + d.valor_centavos);
    pegarMes(mesDe(d.ocorrido_em)).despesasCentavos += d.valor_centavos;
  }

  for (const m of meses.values()) {
    m.lucroCentavos =
      m.brutoCentavos - m.taxaCentavos - m.custoIaCentavos - m.despesasCentavos;
  }

  return {
    brutoCentavos,
    taxaCentavos,
    custoIaCentavos,
    despesasCentavos,
    investidoEmCampanhasCentavos,
    lucroCentavos: brutoCentavos - taxaCentavos - custoIaCentavos - despesasCentavos,
    vendas: pagos.length,
    ticketMedioCentavos: pagos.length > 0 ? Math.round(brutoCentavos / pagos.length) : 0,
    porCategoria: [...categorias]
      .map(([categoria, centavos]) => ({ categoria, centavos }))
      .sort((a, b) => b.centavos - a.centavos),
    porMes: [...meses]
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes)),
  };
}
