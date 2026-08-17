import { randomUUID } from 'crypto';
import type { Migracao } from './tipos';

const UM_DIA_MS = 86_400_000;

/**
 * Trinta dias de Revelação, de cortesia, pra todo mundo que já comprou.
 *
 * ── Por que isto é seguro, e não uma troca do que a pessoa pagou ──────────
 *
 * Quem comprou avulso comprou acesso **pra sempre** — está escrito em
 * `produtos.ts` ("ninguém perde o que pagou"). Esta cortesia não substitui
 * isso: `direitosEfetivos()` une as assinaturas ativas COM os direitos
 * derivados dos pedidos pagos, e os derivados dos pedidos não expiram nunca.
 *
 * Então o que acontece de fato é: por 30 dias a pessoa tem o que comprou MAIS
 * o que a Revelação abre (Oráculo, calendário do mês, guia por e-mail); no
 * dia 31 ela volta exatamente ao que já tinha. Ninguém desce abaixo da linha
 * de partida — a única coisa que pode acontecer é a pessoa sentir falta do
 * que provou, que é justamente o ponto.
 *
 * ── Idempotência ──────────────────────────────────────────────────────────
 *
 * Migração roda uma vez (o runner marca), mas `pedido_id` é único em
 * `assinaturas` e o INSERT usa ON CONFLICT — então mesmo rodada duas vezes
 * por acidente ela não dá 60 dias a ninguém.
 *
 * Contas sem pedido pago não entram: o convite é pra quem comprou.
 */
const migracao: Migracao = {
  id: '012_cortesia_para_quem_comprou',
  descricao: '30 dias de Revelação para todas as contas com compra anterior',
  up: (db) => {
    /**
     * `contas` nasce em `src/lib/autenticacao.ts`, importado só DEPOIS de
     * `db.ts` rodar as migrações — num banco novo ela ainda não existe aqui.
     * E banco novo não tem cliente antigo pra agraciar, então não há nada a
     * fazer mesmo: sair é a resposta certa, não um remendo.
     */
    const temContas = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'contas'`)
      .get();
    if (!temContas) return;

    const agora = new Date();
    const agoraIso = agora.toISOString();
    const fim = new Date(agora.getTime() + 30 * UM_DIA_MS).toISOString();

    /**
     * Uma cortesia por CONTA, não por pedido: quem comprou três vezes ganha
     * 30 dias, não 90. `MIN(p.id)` só amarra a assinatura a um pedido real
     * pra manter o rastro de auditoria e a trava de unicidade.
     */
    const contas = db
      .prepare(
        `SELECT c.id AS conta_id, MIN(p.id) AS pedido_id
         FROM contas c
         JOIN pedidos p ON lower(p.email) = c.email
         WHERE p.status NOT IN ('aguardando_pagamento', 'cancelado', 'estornado')
         GROUP BY c.id`
      )
      .all() as { conta_id: string; pedido_id: string }[];

    const inserir = db.prepare(
      `INSERT INTO assinaturas
         (id, conta_id, plano_id, status, inicio, fim, renovacao_automatica,
          pedido_id, criado_em, atualizado_em)
       VALUES (@id, @conta_id, 'revelacao_mensal', 'ativa', @agora, @fim, 0,
          @pedido_id, @agora, @agora)
       ON CONFLICT(pedido_id) WHERE pedido_id IS NOT NULL DO NOTHING`
    );

    for (const conta of contas) {
      inserir.run({
        id: randomUUID(),
        conta_id: conta.conta_id,
        pedido_id: conta.pedido_id,
        agora: agoraIso,
        fim,
      });
    }
  },
};

export default migracao;
