import db from '../lib/db';

/**
 * O que acontece **depois** da compra.
 *
 * ── Por que isto importa em assinatura de um jeito que não importa em PDF ──
 *
 * Quem compra uma revelação e some já pagou: a venda está fechada, e o
 * desfecho dela não muda mais. Quem assina e some **cancela no mês seguinte**
 * — só que o cancelamento chega trinta dias depois de a decisão ter sido
 * tomada, e nesse meio-tempo não havia nada no sistema dizendo que ela estava
 * sendo tomada.
 *
 * Uso é o único indicador antecedente de churn que existe aqui. É a diferença
 * entre descobrir a perda quando ela acontece e ver a pessoa se afastando com
 * três semanas de antecedência.
 *
 * ── E o custo, que fecha a conta ──────────────────────────────────────────
 *
 * Assinatura consome IA todo mês, sem venda nova para pagar por ela. Um
 * assinante de R$ 29,90 que gasta R$ 40 de modelo é prejuízo com cara de
 * crescimento: mais gente entrando piora o resultado, e o painel de MRR
 * mostraria isso subindo.
 *
 * Nada aqui precisou de coluna nova além do carimbo da entrega: `contas`
 * guarda o último acesso desde sempre, e `leituras` guarda o custo de cada
 * resposta desde a migração 016. O que faltava era alguém perguntar.
 */

export interface UsoDoAssinante {
  conta_id: string;
  /** Quando a chave saiu. `null` numa cobrança paga é entrega que falhou. */
  acessoEnviadoEm: string | null;
  /** `null` = nunca entrou. O acesso morreu na caixa de entrada. */
  ultimoAcessoEm: string | null;
  /** Perguntas ao Oráculo, no total. */
  consultas: number;
  /** Leituras completas, no total. */
  leituras: number;
  /** A última vez que a pessoa pediu qualquer coisa à IA. */
  ultimoUsoEm: string | null;
  /** O que essa pessoa custou de modelo, desde sempre. */
  custoIaCentavos: number;
  /** E no mês corrente — o número que se compara com a mensalidade. */
  custoIaNoMesCentavos: number;
}

/**
 * O uso de várias contas de uma vez.
 *
 * Em lote de propósito: a tela de assinantes lista dezenas de pessoas, e uma
 * consulta por linha transforma abrir o painel em dezenas de varreduras.
 */
export function usoDasContas(
  contaIds: string[],
  agora = new Date()
): Map<string, UsoDoAssinante> {
  const mapa = new Map<string, UsoDoAssinante>();
  if (contaIds.length === 0) return mapa;

  const lacunas = contaIds.map(() => '?').join(',');
  const inicioDoMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();

  for (const id of contaIds) {
    mapa.set(id, {
      conta_id: id,
      acessoEnviadoEm: null,
      ultimoAcessoEm: null,
      consultas: 0,
      leituras: 0,
      ultimoUsoEm: null,
      custoIaCentavos: 0,
      custoIaNoMesCentavos: 0,
    });
  }

  const acessos = db
    .prepare(`SELECT id, ultimo_acesso_em FROM contas WHERE id IN (${lacunas})`)
    .all(...contaIds) as { id: string; ultimo_acesso_em: string | null }[];
  for (const a of acessos) {
    const linha = mapa.get(a.id);
    if (linha) linha.ultimoAcessoEm = a.ultimo_acesso_em;
  }

  /*
    A entrega mais recente da conta. Uma pessoa que assinou, saiu e voltou tem
    duas — e a que interessa para "ela está com o acesso?" é a última.
  */
  const entregas = db
    .prepare(
      `SELECT conta_id, MAX(acesso_enviado_em) enviado FROM cobrancas
        WHERE conta_id IN (${lacunas}) AND acesso_enviado_em IS NOT NULL
        GROUP BY conta_id`
    )
    .all(...contaIds) as { conta_id: string; enviado: string }[];
  for (const e of entregas) {
    const linha = mapa.get(e.conta_id);
    if (linha) linha.acessoEnviadoEm = e.enviado;
  }

  const uso = db
    .prepare(
      `SELECT conta_id, tipo, COUNT(*) n, MAX(criado_em) ultima,
              COALESCE(SUM(custo_centavos), 0) custo,
              COALESCE(SUM(CASE WHEN criado_em >= ? THEN custo_centavos ELSE 0 END), 0) custo_mes
         FROM leituras
        WHERE conta_id IN (${lacunas})
        GROUP BY conta_id, tipo`
    )
    .all(inicioDoMes, ...contaIds) as {
    conta_id: string;
    tipo: string;
    n: number;
    ultima: string | null;
    custo: number;
    custo_mes: number;
  }[];

  for (const u of uso) {
    const linha = mapa.get(u.conta_id);
    if (!linha) continue;
    if (u.tipo === 'leitura') linha.leituras += u.n;
    else linha.consultas += u.n;
    linha.custoIaCentavos += u.custo;
    linha.custoIaNoMesCentavos += u.custo_mes;
    if (u.ultima && (!linha.ultimoUsoEm || u.ultima > linha.ultimoUsoEm)) {
      linha.ultimoUsoEm = u.ultima;
    }
  }

  return mapa;
}

export interface ResumoDeUso {
  /** Pagou e nunca entrou. O acesso morreu na caixa de entrada. */
  nuncaEntraram: number;
  /** Entrou e nunca pediu nada à IA. Está pagando por algo que não usa. */
  entraramENaoUsaram: number;
  /**
   * Sem sinal de vida há mais de 14 dias, entre quem já usou alguma vez.
   *
   * Catorze dias porque um ciclo de cobrança é de trinta: quem sumiu há duas
   * semanas ainda dá tempo de reconquistar antes da renovação. Um mês inteiro
   * de silêncio já é o cancelamento, só que ainda não digitado.
   */
  sumidos: number;
  custoIaNoMesCentavos: number;
  /** Quanto o assinante mais caro custou de IA neste mês. */
  maiorCustoNoMesCentavos: number;
}

const QUATORZE_DIAS = 14 * 86_400_000;

export function resumoDeUso(
  usos: UsoDoAssinante[],
  agora = new Date()
): ResumoDeUso {
  const limite = agora.getTime() - QUATORZE_DIAS;
  let nuncaEntraram = 0;
  let entraramENaoUsaram = 0;
  let sumidos = 0;
  let custoIaNoMesCentavos = 0;
  let maiorCustoNoMesCentavos = 0;

  for (const u of usos) {
    const usou = u.consultas + u.leituras > 0;
    if (!u.ultimoAcessoEm) nuncaEntraram += 1;
    else if (!usou) entraramENaoUsaram += 1;
    else if (u.ultimoUsoEm && Date.parse(u.ultimoUsoEm) < limite) sumidos += 1;

    custoIaNoMesCentavos += u.custoIaNoMesCentavos;
    maiorCustoNoMesCentavos = Math.max(maiorCustoNoMesCentavos, u.custoIaNoMesCentavos);
  }

  return {
    nuncaEntraram,
    entraramENaoUsaram,
    sumidos,
    custoIaNoMesCentavos,
    maiorCustoNoMesCentavos,
  };
}
