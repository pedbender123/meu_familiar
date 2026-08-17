import { randomUUID } from 'crypto';
import db from '../lib/db';
import { buscarPlano, type Plano } from './planos';
import { criarAssinatura, type Assinatura } from './assinaturas';

export interface Cobranca {
  id: string;
  conta_id: string;
  email: string;
  plano_id: string;
  valor_centavos: number;
  status: 'aguardando_pagamento' | 'pago' | 'cancelado';
  pagamento_id: string | null;
  metodo: string | null;
  bruto_centavos: number | null;
  taxa_centavos: number | null;
  liquido_centavos: number | null;
  assinatura_id: string | null;
  pago_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Abre uma cobrança para um plano.
 *
 * O valor vem do PLANO, lido do banco no servidor — nunca do cliente. É a
 * mesma regra de `montarCorpo`: preço que passa pelo navegador é preço
 * editável, e aqui não há nem cupom pra justificar exceção.
 */
export function abrirCobranca(dados: {
  contaId: string;
  email: string;
  planoId: string;
}): { cobranca: Cobranca; plano: Plano } | null {
  const plano = buscarPlano(dados.planoId);
  if (!plano || !plano.ativo || !plano.publico) return null;
  // Plano grátis não gera cobrança: quem tentar assinar o gratuito por aqui
  // está no caminho errado, e criar uma cobrança de R$ 0,00 só produziria uma
  // linha que o gateway recusaria depois.
  if (plano.preco_centavos <= 0) return null;

  const agora = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO cobrancas
       (id, conta_id, email, plano_id, valor_centavos, status, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, 'aguardando_pagamento', ?, ?)`
  ).run(id, dados.contaId, dados.email.trim().toLowerCase(), plano.id, plano.preco_centavos, agora, agora);

  return { cobranca: buscarCobranca(id)!, plano };
}

export function buscarCobranca(id: string): Cobranca | undefined {
  return db.prepare('SELECT * FROM cobrancas WHERE id = ?').get(id) as Cobranca | undefined;
}

export function buscarCobrancaPorPagamento(pagamentoId: string): Cobranca | undefined {
  return db
    .prepare('SELECT * FROM cobrancas WHERE pagamento_id = ?')
    .get(pagamentoId) as Cobranca | undefined;
}

export function anotarPagamento(id: string, pagamentoId: string): void {
  db.prepare(
    `UPDATE cobrancas SET pagamento_id = ?, atualizado_em = ? WHERE id = ?`
  ).run(pagamentoId, new Date().toISOString(), id);
}

/**
 * Confirma a cobrança e cria a assinatura.
 *
 * **Idempotente**, e tem que ser: o webhook do Mercado Pago reenvia a mesma
 * notificação quando não recebe 200 rápido o bastante, e a segunda passagem
 * não pode dar um segundo mês de plano a ninguém. A trava é o `status` já
 * `pago` — checado e escrito na mesma transação.
 *
 * O `fim` sai do `duracao_dias` do plano (ver `criarAssinatura`), então
 * renovar é simplesmente pagar de novo: nasce outra assinatura com outro
 * prazo, e `direitosEfetivos` une as duas.
 */
export function confirmarPagamento(
  id: string,
  detalhes: {
    metodo?: string | null;
    brutoCentavos?: number | null;
    taxaCentavos?: number | null;
    liquidoCentavos?: number | null;
  } = {}
): { cobranca: Cobranca; assinatura: Assinatura | null } | null {
  const agora = new Date();

  const transacao = db.transaction(() => {
    const cobranca = buscarCobranca(id);
    if (!cobranca) return null;

    // Já confirmada: devolve o que existe, sem criar nada de novo.
    if (cobranca.status === 'pago') {
      return {
        cobranca,
        assinatura: cobranca.assinatura_id
          ? (db
              .prepare('SELECT * FROM assinaturas WHERE id = ?')
              .get(cobranca.assinatura_id) as Assinatura)
          : null,
      };
    }

    const assinatura = criarAssinatura({
      contaId: cobranca.conta_id,
      planoId: cobranca.plano_id,
      inicio: agora,
    });

    db.prepare(
      `UPDATE cobrancas SET
         status = 'pago', pago_em = @agora, atualizado_em = @agora,
         assinatura_id = @assinatura, metodo = COALESCE(@metodo, metodo),
         bruto_centavos = COALESCE(@bruto, bruto_centavos),
         taxa_centavos = COALESCE(@taxa, taxa_centavos),
         liquido_centavos = COALESCE(@liquido, liquido_centavos)
       WHERE id = @id`
    ).run({
      id,
      agora: agora.toISOString(),
      assinatura: assinatura?.id ?? null,
      metodo: detalhes.metodo ?? null,
      bruto: detalhes.brutoCentavos ?? null,
      taxa: detalhes.taxaCentavos ?? null,
      liquido: detalhes.liquidoCentavos ?? null,
    });

    return { cobranca: buscarCobranca(id)!, assinatura };
  });

  return transacao();
}

export function cobrancasDaConta(contaId: string): Cobranca[] {
  return db
    .prepare('SELECT * FROM cobrancas WHERE conta_id = ? ORDER BY criado_em DESC')
    .all(contaId) as Cobranca[];
}
