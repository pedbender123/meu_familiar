import type { Migracao } from './tipos';

/**
 * Qual transação pagou o período atual da assinatura.
 *
 * ── O bug que isto conserta, visto em produção ────────────────────────────
 *
 * A primeira assinatura real de R$ 29,90 nasceu com 120 dias de acesso em vez
 * de 30. Ninguém digitou nada errado: a Wiven **reenvia o webhook** até
 * receber 200, e o nosso tratamento de renovação somava o período a cada
 * chegada.
 *
 * A primeira notificação confirmava a cobrança. Da segunda em diante, a
 * cobrança já estava `pago`, o código concluía "dinheiro novo entrando" e
 * esticava o acesso mais 30 dias. Quatro entregas, quatro meses.
 *
 * É o mesmo erro que `confirmarPagamento` já evitava havia meses — ela é
 * idempotente exatamente por isso — e que a renovação reintroduziu por ter
 * sido escrita como o caso oposto dela.
 *
 * ── Por que a transação, e não um contador ────────────────────────────────
 *
 * Reenvio e renovação são indistinguíveis pelo status: os dois chegam como
 * pagamento aprovado do mesmo contrato. O que os separa é o **id da
 * transação** — reenvio repete o id, renovação traz um novo. Guardar qual id
 * pagou o período atual responde a pergunta sem depender de tempo, de
 * contagem, ou de confiar que o gateway não repete.
 */
const migracao: Migracao = {
  id: '037_transacao_da_renovacao',
  descricao: 'Guarda a transação que pagou o período atual, contra renovação em dobro',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(assinaturas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('ultima_transacao')) {
      db.exec(`ALTER TABLE assinaturas ADD COLUMN ultima_transacao TEXT`);
    }
  },
};

export default migracao;
