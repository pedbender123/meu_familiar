import db from '../lib/db';
import { checarEmLinha } from './sentinela/emLinha';
import type { Assinatura } from './assinaturas';

const UM_DIA_MS = 86_400_000;

/**
 * O relógio das assinaturas: o que venceu, e o que está para vencer.
 *
 * ── Por que expirar é um job e não só uma consulta ────────────────────────
 *
 * `assinaturasAtivasDaConta` já ignora quem passou do `fim`, então o ACESSO
 * fecha sozinho na hora certa mesmo sem job nenhum — isso é de propósito, pra
 * que um cron parado nunca libere acesso indevido.
 *
 * O job existe pelo outro lado: sem ele o `status` mente. Uma assinatura
 * vencida em janeiro continuaria escrita como 'ativa' pra sempre, e todo
 * relatório de quantas assinaturas existem sairia errado — inclusive o churn
 * da Fase 11. O job faz o registro contar a mesma história que o acesso.
 */
export function expirarVencidas(agora = new Date()): number {
  const info = db
    .prepare(
      `UPDATE assinaturas
       SET status = 'expirada', atualizado_em = ?
       WHERE status = 'ativa' AND fim IS NOT NULL AND fim <= ?`
    )
    .run(agora.toISOString(), agora.toISOString());
  return info.changes;
}

export interface AssinaturaVencendo extends Assinatura {
  email: string;
  plano_nome: string;
  dias_restantes: number;
}

/**
 * Quem vence dentro de `dias` — a lista do aviso de renovação.
 *
 * **O aviso é relativo ao `fim` de cada assinatura, não a uma data fixa do
 * calendário.** As assinaturas vencem em datas rolantes (30 ou 365 dias a
 * contar da compra de cada pessoa), então "aviso na primeira semana do mês"
 * acertaria só quem comprou no fim do mês anterior e pegaria todo o resto na
 * hora errada — uns depois de já ter vencido.
 *
 * Só `renovacao_automatica = 0`: quem tem cobrança automática no cartão não
 * precisa ser lembrado de pagar, vai ser cobrado. Como Pix não faz cobrança
 * recorrente (nenhum provedor faz — Pix é sempre avulso), toda assinatura
 * paga no Pix cai aqui, e é este e-mail que faz a renovação acontecer.
 */
export function vencendoEm(dias = 7, agora = new Date()): AssinaturaVencendo[] {
  const limite = new Date(agora.getTime() + dias * UM_DIA_MS).toISOString();

  const linhas = db
    .prepare(
      `SELECT a.*, c.email AS email, p.nome AS plano_nome
       FROM assinaturas a
       JOIN contas c ON c.id = a.conta_id
       LEFT JOIN planos p ON p.id = a.plano_id
       WHERE a.status = 'ativa'
         AND a.renovacao_automatica = 0
         AND a.fim IS NOT NULL
         AND a.fim > ? AND a.fim <= ?
       ORDER BY a.fim ASC`
    )
    .all(agora.toISOString(), limite) as (Assinatura & {
    email: string;
    plano_nome: string | null;
  })[];

  return linhas.map((l) => ({
    ...l,
    plano_nome: l.plano_nome ?? l.plano_id,
    dias_restantes: Math.max(
      0,
      Math.ceil((new Date(l.fim!).getTime() - agora.getTime()) / UM_DIA_MS)
    ),
  }));
}

/**
 * Invariante: assinatura recorrente sem `fim` é acesso vitalício dado por
 * engano.
 *
 * É o erro mais caro que este subsistema pode cometer em silêncio — a pessoa
 * paga um mês e nunca mais é cobrada, e nada na tela denuncia. Roda como
 * varredura porque não tem dono: não é falha de um pedido, é uma linha que
 * não deveria existir do jeito que está.
 */
export function varrerAssinaturasSemPrazo(): void {
  const orfas = db
    .prepare(
      `SELECT a.id, a.plano_id FROM assinaturas a
       JOIN planos p ON p.id = a.plano_id
       WHERE a.fim IS NULL AND p.duracao_dias IS NOT NULL AND a.status = 'ativa'`
    )
    .all() as { id: string; plano_id: string }[];

  for (const orfa of orfas) {
    checarEmLinha('assinatura_sem_prazo', () => ({
      invariante: 'assinatura_sem_prazo',
      severidade: 'alto' as const,
      entidadeTipo: 'assinatura',
      entidadeId: orfa.id,
      esperado: `assinatura do plano ${orfa.plano_id} (que tem prazo) deveria ter fim preenchido`,
      encontrado: 'fim nulo — acesso nunca expira',
    }));
  }
}
