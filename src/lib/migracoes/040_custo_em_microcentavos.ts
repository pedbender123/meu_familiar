import type { Migracao } from './tipos';

/**
 * O custo de IA da assinatura, numa unidade que consegue representá-lo.
 *
 * ── O que estava acontecendo, medido em produção ──────────────────────────
 *
 * Uma consulta ao Oráculo custa 0,17 centavo. `custo_centavos` é inteiro, e
 * 0,17 arredondado é zero. Em 01/09 as sete leituras do banco somavam
 * **R$ 0,00** — não por imprecisão, mas porque cada parcela virava zero antes
 * de entrar na soma. Cem consultas num mês continuariam somando zero.
 *
 * Isso torna impossível a única pergunta que decide se assinatura se paga:
 * quanto uma pessoa custa por mês. Um assinante de R$ 29,90 que gasta R$ 40
 * de modelo é prejuízo com cara de crescimento — e o painel mostraria custo
 * zero para ele.
 *
 * ── Por que uma coluna nova, e não trocar a unidade da antiga ─────────────
 *
 * `custo_centavos` já tem valor gravado em milhares de linhas em outras
 * tabelas com o mesmo nome e o mesmo significado. Reinterpretar a unidade de
 * uma coluna existente é o tipo de mudança que não quebra nada hoje e produz
 * um número mil vezes errado no primeiro lugar que esquecer de converter.
 *
 * As duas convivem: a antiga continua sendo centavos, e para leitura de
 * Oráculo continua sendo zero — que é a verdade arredondada. A nova é a que
 * o painel de assinantes soma.
 *
 * ── O que fica sem resposta ───────────────────────────────────────────────
 *
 * As leituras anteriores a esta migração não podem ser recuperadas com
 * precisão... **exceto que podem**: `tokens_entrada` e `tokens_saida` estão
 * gravados desde a migração 016, e o preço do modelo é conhecido. O
 * preenchimento abaixo refaz a conta em vez de inventar valor.
 */
const migracao: Migracao = {
  id: '040_custo_em_microcentavos',
  descricao: 'Custo de IA em milésimos de centavo, que é a ordem de grandeza real',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(leituras)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('custo_microcentavos')) {
      db.exec(`ALTER TABLE leituras ADD COLUMN custo_microcentavos INTEGER`);
    }

    /*
      Refaz a conta do que já está gravado.

      Não é inventar histórico: os tokens de cada chamada estão na linha desde
      que ela nasceu, e o preço do modelo é o mesmo. É a mesma conta que
      `microcentavosDeTexto` faz, escrita em SQL para não depender de importar
      código da aplicação numa migração — migração que importa módulo do app
      quebra no dia em que o módulo mudar de forma.

      Os preços estão fixos aqui de propósito, e por isso: eles são os que
      valiam quando estas linhas foram criadas. Se a tabela de preços mudar
      amanhã, o histórico não pode ser reescrito com o preço novo.
    */
    db.exec(`
      UPDATE leituras
         SET custo_microcentavos = CAST(ROUND(
               (COALESCE(tokens_entrada, 0) / 1000000.0 *
                 CASE modelo WHEN 'gemini-3.1-flash-lite' THEN 0.075 ELSE 0.1 END
                + COALESCE(tokens_saida, 0) / 1000000.0 *
                 CASE modelo WHEN 'gemini-3.1-flash-lite' THEN 0.3 ELSE 0.4 END)
               * 5.6 * 100 * 1000
             ) AS INTEGER)
       WHERE custo_microcentavos IS NULL
    `);
  },
};

export default migracao;
