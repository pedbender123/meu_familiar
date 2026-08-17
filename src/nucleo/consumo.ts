import db from '../lib/db';
import { direitosEfetivos } from './acesso';
import type { Direitos } from './direitos';

/**
 * O gasto de cota, com as duas travas.
 *
 * `consumir()` é a única porta: ela checa o teto do dia E o do mês, grava o
 * uso e devolve se passou — tudo **numa transação**. Sem isso, duas abas
 * abertas no celular gastam a mesma pergunta duas vezes, que é o bug clássico
 * deste tipo de contador e o mais chato de reproduzir depois.
 */
export type Recurso = 'mensagem' | 'leitura';

/** Onde cada recurso lê o teto. Um lugar só, pra tela e cobrança não divergirem. */
const TETOS: Record<Recurso, { mes: keyof Direitos; dia: number | keyof Direitos }> = {
  mensagem: { mes: 'perguntasOraculo', dia: 'perguntasOraculoPorDia' },
  /**
   * A leitura tem teto diário FIXO em 1, não vindo de direito: ela é um
   * ritual de vários minutos com espetáculos, e duas no mesmo dia
   * desmontariam a raridade que faz ela valer. O que os planos diferenciam é
   * quantas cabem no mês.
   */
  leitura: { mes: 'leiturasPorMes', dia: 1 },
};

function tetoDe(direitos: Direitos, valor: number | keyof Direitos): number {
  return typeof valor === 'number' ? valor : (direitos[valor] as number);
}

export function chaveDoDia(quando = new Date()): string {
  return `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(
    quando.getDate()
  ).padStart(2, '0')}`;
}

export function chaveDoMes(quando = new Date()): string {
  return `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}`;
}

function usoAtual(contaId: string, recurso: Recurso, janela: string, chave: string): number {
  const linha = db
    .prepare(
      `SELECT usado FROM consumo
       WHERE conta_id = ? AND recurso = ? AND janela = ? AND chave = ?`
    )
    .get(contaId, recurso, janela, chave) as { usado: number } | undefined;
  return linha?.usado ?? 0;
}

export interface EstadoDaCota {
  usadoHoje: number;
  usadoNoMes: number;
  tetoDiario: number;
  tetoMensal: number;
  restanteHoje: number;
  restanteNoMes: number;
  /** O que a pessoa pode gastar agora — o menor dos dois restantes. */
  disponivel: number;
}

/**
 * Quanto sobra, sem gastar nada. É o que a tela mostra.
 *
 * `disponivel` é o MENOR dos dois restantes de propósito: dizer "você tem 20
 * perguntas" quando o teto do dia já bateu é mentira útil pra ninguém — a
 * pessoa clica e leva "não".
 */
export function estadoDaCota(
  contaId: string,
  email: string,
  recurso: Recurso,
  quando = new Date()
): EstadoDaCota {
  const direitos = direitosEfetivos(contaId, email, quando);
  const tetoMensal = tetoDe(direitos, TETOS[recurso].mes);
  const tetoDiario = tetoDe(direitos, TETOS[recurso].dia);

  const usadoHoje = usoAtual(contaId, recurso, 'dia', chaveDoDia(quando));
  const usadoNoMes = usoAtual(contaId, recurso, 'mes', chaveDoMes(quando));

  const restanteHoje = Math.max(0, tetoDiario - usadoHoje);
  const restanteNoMes = Math.max(0, tetoMensal - usadoNoMes);

  return {
    usadoHoje,
    usadoNoMes,
    tetoDiario,
    tetoMensal,
    restanteHoje,
    restanteNoMes,
    disponivel: Math.min(restanteHoje, restanteNoMes),
  };
}

export type ResultadoDoConsumo =
  | { ok: true; restanteHoje: number; restanteNoMes: number }
  | { ok: false; motivo: 'sem_cota_no_dia' | 'sem_cota_no_mes' | 'sem_plano' };

/**
 * Gasta uma unidade, se couber nas duas travas.
 *
 * A transação abraça leitura E escrita: sem ela, dois cliques simultâneos
 * leem "usado: 4", os dois concluem que cabe, e os dois gravam 5 — a pessoa
 * gastou uma e levou duas. Com ela, o segundo espera o primeiro e vê 5.
 *
 * Devolve o motivo em vez de lançar porque quem chama é uma tela: ela precisa
 * dizer "seu limite de hoje acabou, volta amanhã" (que é diferente de "sua
 * cota do mês acabou, considere subir de plano") — dois textos, duas ofertas.
 */
export function consumir(
  contaId: string,
  email: string,
  recurso: Recurso,
  quando = new Date()
): ResultadoDoConsumo {
  const direitos = direitosEfetivos(contaId, email, quando);
  const tetoMensal = tetoDe(direitos, TETOS[recurso].mes);
  const tetoDiario = tetoDe(direitos, TETOS[recurso].dia);

  if (tetoMensal <= 0 || tetoDiario <= 0) return { ok: false, motivo: 'sem_plano' };

  const dia = chaveDoDia(quando);
  const mes = chaveDoMes(quando);
  const agora = quando.toISOString();

  const transacao = db.transaction((): ResultadoDoConsumo => {
    const usadoHoje = usoAtual(contaId, recurso, 'dia', dia);
    if (usadoHoje >= tetoDiario) return { ok: false, motivo: 'sem_cota_no_dia' };

    const usadoNoMes = usoAtual(contaId, recurso, 'mes', mes);
    if (usadoNoMes >= tetoMensal) return { ok: false, motivo: 'sem_cota_no_mes' };

    const gravar = db.prepare(
      `INSERT INTO consumo (conta_id, recurso, janela, chave, usado, atualizado_em)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT (conta_id, recurso, janela, chave)
       DO UPDATE SET usado = usado + 1, atualizado_em = excluded.atualizado_em`
    );
    gravar.run(contaId, recurso, 'dia', dia, agora);
    gravar.run(contaId, recurso, 'mes', mes, agora);

    return {
      ok: true,
      restanteHoje: tetoDiario - usadoHoje - 1,
      restanteNoMes: tetoMensal - usadoNoMes - 1,
    };
  });

  return transacao();
}

/**
 * Devolve uma unidade — para quando a geração falha depois do consumo.
 *
 * Cobrar por uma leitura que não chegou é o pior jeito de perder um assinante,
 * e a chamada de IA falha por motivos que não são culpa de ninguém (timeout,
 * cota do provedor). Nunca desce abaixo de zero: devolver duas vezes o mesmo
 * crédito daria cota de graça.
 */
export function devolver(
  contaId: string,
  recurso: Recurso,
  quando = new Date()
): void {
  const agora = quando.toISOString();
  const devolucao = db.prepare(
    `UPDATE consumo SET usado = MAX(0, usado - 1), atualizado_em = ?
     WHERE conta_id = ? AND recurso = ? AND janela = ? AND chave = ?`
  );

  db.transaction(() => {
    devolucao.run(agora, contaId, recurso, 'dia', chaveDoDia(quando));
    devolucao.run(agora, contaId, recurso, 'mes', chaveDoMes(quando));
  })();
}
