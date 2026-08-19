import db from '../lib/db';

/**
 * A leitura do negócio de assinatura — o que o painel precisa saber.
 *
 * ── Por que é um módulo novo e não uma função em `financeiro.ts` ──────────
 *
 * `financeiro.ts` foi escrito para o mundo de pedidos avulsos: ele soma
 * vendas que aconteceram uma vez. Assinatura é outra pergunta — não "quanto
 * entrou ontem", mas "quanto entra todo mês se ninguém mexer em nada", que é
 * uma projeção, não um somatório de caixa.
 *
 * Misturar os dois na mesma tabela produz o erro clássico de painel de SaaS:
 * somar a venda anual inteira no mês em que ela caiu e comemorar um mês
 * excepcional que não vai se repetir.
 *
 * ── MRR aqui é receita NORMALIZADA, não caixa ─────────────────────────────
 *
 * Cada assinatura ativa vira o seu valor por mês: mensal conta o preço cheio,
 * anual conta o preço dividido por doze. É a única forma de comparar os dois
 * e a única de a soma significar "o que se repete".
 */

export interface LinhaDeAssinante {
  id: string;
  conta_id: string;
  email: string;
  plano_id: string;
  plano_nome: string;
  preco_centavos: number;
  porMesCentavos: number;
  status: string;
  inicio: string;
  fim: string | null;
  renovacao_automatica: number;
  /** Quanto essa pessoa já pagou no total, somando todas as cobranças pagas. */
  pagoCentavos: number;
  diasRestantes: number | null;
}

const UM_DIA = 86_400_000;

/** `true` para planos com preço e prazo — os que produzem receita repetida. */
function contaComoReceita(preco: number, dias: number | null): boolean {
  return preco > 0 && dias !== null;
}

/**
 * O preço convertido em "por mês de calendário".
 *
 * ── Por que não é `preço × 30 ÷ dias` ─────────────────────────────────────
 *
 * Parece a fórmula óbvia e está errada para o anual: 365 dias não são 12,17
 * meses de 30 dias, são 12 meses. A conta por janela de 30 dias transforma
 * R$ 360/ano em R$ 29,59/mês em vez de R$ 30 — 1,4% a menos, em cima da
 * receita inteira, para sempre. Um teste pegou isso antes de o número virar
 * decisão.
 *
 * Contar em MESES resolve os dois casos com a mesma linha: 30 dias → 1 mês,
 * 365 → 12. O arredondamento é seguro porque as durações vendidas são essas
 * duas; qualquer prazo novo cai no mês mais próximo, que é o que um painel de
 * receita recorrente quer dizer de qualquer forma.
 */
function porMes(preco: number, dias: number | null): number {
  if (!contaComoReceita(preco, dias)) return 0;
  const meses = Math.max(1, Math.round((dias as number) / 30.44));
  return Math.round(preco / meses);
}

/**
 * Todo mundo com assinatura ativa AGORA.
 *
 * `fim > agora OR fim IS NULL` em vez de `status = 'ativa'`: o status é
 * mantido por um cron, e cron pode estar parado. A data não mente, e é a
 * mesma regra que `assinaturasAtivasDaConta` usa para liberar acesso — o
 * painel precisa contar exatamente quem está entrando, não quem uma varredura
 * lembrou de marcar.
 */
export function assinantesAtivos(agora = new Date()): LinhaDeAssinante[] {
  const linhas = db
    .prepare(
      `SELECT a.id, a.conta_id, a.plano_id, a.status, a.inicio, a.fim,
              a.renovacao_automatica,
              c.email AS email,
              p.nome AS plano_nome, p.preco_centavos, p.duracao_dias,
              COALESCE((
                SELECT SUM(cb.valor_centavos) FROM cobrancas cb
                 WHERE cb.conta_id = a.conta_id AND cb.status = 'pago'
              ), 0) AS pago_centavos
         FROM assinaturas a
         JOIN contas c ON c.id = a.conta_id
         LEFT JOIN planos p ON p.id = a.plano_id
        WHERE a.status = 'ativa'
          AND (a.fim IS NULL OR a.fim > @agora)
        ORDER BY p.preco_centavos DESC, a.inicio DESC`
    )
    .all({ agora: agora.toISOString() }) as (Record<string, unknown> & {
    preco_centavos: number | null;
    duracao_dias: number | null;
  })[];

  return linhas.map((l) => {
    const preco = l.preco_centavos ?? 0;
    const dias = l.duracao_dias ?? null;
    const fim = (l.fim as string | null) ?? null;
    return {
      id: l.id as string,
      conta_id: l.conta_id as string,
      email: l.email as string,
      plano_id: l.plano_id as string,
      plano_nome: (l.plano_nome as string | null) ?? (l.plano_id as string),
      preco_centavos: preco,
      porMesCentavos: porMes(preco, dias),
      status: l.status as string,
      inicio: l.inicio as string,
      fim,
      renovacao_automatica: l.renovacao_automatica as number,
      pagoCentavos: l.pago_centavos as number,
      diasRestantes: fim
        ? Math.max(0, Math.ceil((new Date(fim).getTime() - agora.getTime()) / UM_DIA))
        : null,
    };
  });
}

export interface ResumoDoPlano {
  plano_id: string;
  plano_nome: string;
  quantos: number;
  mrrCentavos: number;
}

export interface ResumoDeAssinantes {
  /** Receita mensal recorrente: soma normalizada dos ativos pagos. */
  mrrCentavos: number;
  /** Quantos pagam de fato — o gratuito fica de fora. */
  pagantes: number;
  /** Quantos estão no plano gratuito. É a base de quem pode virar pagante. */
  gratuitos: number;
  /** Média por pagante. Diz se a escada está puxando gente para cima. */
  ticketMedioCentavos: number;
  porPlano: ResumoDoPlano[];
  /** Ativos que vencem nos próximos 7 dias e não renovam sozinhos. */
  vencendo: LinhaDeAssinante[];
  novosNoMes: number;
  perdidosNoMes: number;
  /**
   * Churn do mês: perdidos ÷ (ativos no começo do mês).
   *
   * `null` quando não havia ninguém no começo do mês — dividir por zero
   * produziria "100% de churn" num mês de estreia, que é o número mais
   * enganoso que um painel de SaaS pode mostrar.
   */
  churnMes: number | null;
}

export function resumoDeAssinantes(agora = new Date()): ResumoDeAssinantes {
  const ativos = assinantesAtivos(agora);

  const pagos = ativos.filter((a) => a.porMesCentavos > 0);
  const gratuitos = ativos.length - pagos.length;
  const mrrCentavos = pagos.reduce((s, a) => s + a.porMesCentavos, 0);

  const mapa = new Map<string, ResumoDoPlano>();
  for (const a of ativos) {
    const atual = mapa.get(a.plano_id) ?? {
      plano_id: a.plano_id,
      plano_nome: a.plano_nome,
      quantos: 0,
      mrrCentavos: 0,
    };
    atual.quantos++;
    atual.mrrCentavos += a.porMesCentavos;
    mapa.set(a.plano_id, atual);
  }

  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

  const novosNoMes = (
    db
      .prepare(`SELECT COUNT(*) n FROM assinaturas WHERE inicio >= ?`)
      .get(inicioDoMes) as { n: number }
  ).n;

  /**
   * Perdidos = expirados ou cancelados cujo `fim` caiu dentro deste mês.
   * Usa `fim`, não `atualizado_em`: o que interessa é quando o acesso acabou,
   * não quando o cron reparou nisso.
   */
  const perdidosNoMes = (
    db
      .prepare(
        `SELECT COUNT(*) n FROM assinaturas
          WHERE status IN ('expirada', 'cancelada')
            AND fim IS NOT NULL AND fim >= ? AND fim <= ?`
      )
      .get(inicioDoMes, agora.toISOString()) as { n: number }
  ).n;

  const ativosNoComeco = ativos.length - novosNoMes + perdidosNoMes;
  const churnMes = ativosNoComeco > 0 ? perdidosNoMes / ativosNoComeco : null;

  return {
    mrrCentavos,
    pagantes: pagos.length,
    gratuitos,
    ticketMedioCentavos: pagos.length > 0 ? Math.round(mrrCentavos / pagos.length) : 0,
    porPlano: [...mapa.values()].sort((a, b) => b.mrrCentavos - a.mrrCentavos),
    vencendo: ativos
      .filter(
        (a) =>
          a.porMesCentavos > 0 &&
          !a.renovacao_automatica &&
          a.diasRestantes !== null &&
          a.diasRestantes <= 7
      )
      .sort((a, b) => (a.diasRestantes ?? 0) - (b.diasRestantes ?? 0)),
    novosNoMes,
    perdidosNoMes,
    churnMes,
  };
}
