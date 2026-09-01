import type { Migracao } from './tipos';

/**
 * O contrato de recorrência que vive do lado do gateway.
 *
 * ── O que muda ────────────────────────────────────────────────────────────
 *
 * Até aqui, "assinatura" era uma cobrança única de 30 dias mais um e-mail
 * pedindo para a pessoa pagar de novo. Funcionava, e perdia todo mundo que
 * não abrisse o e-mail — que é a maioria.
 *
 * Com `/gateway/pix/subscription` e `/gateway/card/subscription`, a Wiven
 * passa a cobrar sozinha nos meses seguintes. Isso cria uma coisa nova: um
 * contrato que existe LÁ e cobra dinheiro de gente todo mês, independente do
 * nosso banco.
 *
 * ── Por que guardar o id é obrigatório, e não conveniente ─────────────────
 *
 * Sem ele não há como consultar, e principalmente **não há como cancelar**.
 * Uma assinatura recorrente cujo id a gente perdeu é uma cobrança mensal que
 * ninguém consegue parar — a pessoa pede cancelamento, e a única saída seria
 * pedir ao gateway pelo suporte, com o cliente sendo cobrado no meio tempo.
 *
 * `proxima_cobranca_em` é a data que a Wiven informou. Guardada para o painel
 * poder mostrar "cobra de novo em X" sem consultar a API deles a cada tela, e
 * para o relógio das assinaturas conferir se a data que a gente acha bate com
 * a que eles têm.
 */
const migracao: Migracao = {
  id: '035_assinatura_recorrente',
  descricao: 'Guarda o contrato de assinatura criado no gateway',
  up: (db) => {
    const colunasDe = (tabela: string) =>
      (db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((c) => c.name);

    for (const [tabela, coluna] of [
      ['cobrancas', 'assinatura_externa_id'],
      ['cobrancas', 'proxima_cobranca_em'],
      ['assinaturas', 'assinatura_externa_id'],
    ] as const) {
      if (!colunasDe(tabela).includes(coluna)) {
        db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} TEXT`);
      }
    }

    /*
      Duas notificações do mesmo contrato não podem virar duas assinaturas. O
      índice é parcial porque toda assinatura antiga tem a coluna nula, e nulo
      repetido não é colisão.
    */
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_assinaturas_externa
        ON assinaturas (assinatura_externa_id) WHERE assinatura_externa_id IS NOT NULL
    `);
  },
};

export default migracao;
