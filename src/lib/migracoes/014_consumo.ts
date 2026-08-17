import type { Migracao } from './tipos';

/**
 * A cota de duas travas — `consumo`.
 *
 * ── Por que uma linha por janela, e não um contador na conta ──────────────
 *
 * A tentação é uma coluna `perguntas_usadas` em `contas` e um `UPDATE`. Ela
 * quebra na virada do mês: alguém tem que zerar, e esse alguém é um cron que
 * um dia não roda — e aí a pessoa fica sem cota até alguém perceber.
 *
 * Aqui a janela está **na chave**: `janela='mes', chave='2026-08'`. Virou o
 * mês, a chave é outra, a linha não existe, o uso é zero. Nada precisa zerar
 * nada, e um cron parado não tira acesso de ninguém.
 *
 * ── As duas travas ────────────────────────────────────────────────────────
 *
 * "Até 5 por dia, mas 30 no mês" são DOIS limites, não um. O mensal é o que
 * foi vendido; o diário impede alguém queimar o mês numa madrugada de
 * ansiedade e sumir. Protege a margem e protege a pessoa. Por isso a mesma
 * tabela guarda `janela='dia'` e `janela='mes'` do mesmo recurso, e o
 * consumo só passa se as duas couberem.
 *
 * `recurso` separa mensagem de leitura: são cotas independentes, e é essa
 * separação que faz a leitura parecer rara (ver `docs/oraculo.md`).
 */
const migracao: Migracao = {
  id: '014_consumo',
  descricao: 'Cota de duas travas (dia e mês) por recurso',
  up: (db) => {
    db.exec(`
      CREATE TABLE consumo (
        conta_id TEXT NOT NULL,
        -- 'mensagem' | 'leitura'
        recurso TEXT NOT NULL,
        -- 'dia' | 'mes'
        janela TEXT NOT NULL,
        -- '2026-08-17' para dia, '2026-08' para mês
        chave TEXT NOT NULL,
        usado INTEGER NOT NULL DEFAULT 0,
        atualizado_em TEXT NOT NULL,
        PRIMARY KEY (conta_id, recurso, janela, chave)
      )
    `);

    /**
     * A chave primária composta é o que torna o `INSERT ... ON CONFLICT DO
     * UPDATE SET usado = usado + 1` atômico — duas abas no celular clicando
     * ao mesmo tempo não conseguem gastar a mesma pergunta duas vezes, sem
     * precisar de lock explícito.
     */
    db.exec(`CREATE INDEX idx_consumo_conta ON consumo (conta_id, recurso)`);
  },
};

export default migracao;
