import type { Migracao } from './tipos';

/**
 * Fase 3 de docs/reestruturacao.md: checkout como adaptador.
 *
 * `contas_checkout` guarda credenciais de provedor de pagamento **fora**
 * do `.env` — é o que permite duas contas do mesmo provedor (ex.: a de
 * marketing pedindo um checkout à parte) virarem duas linhas em vez de duas
 * famílias de variável de ambiente (o `MP_HOROSCOPO_*` que esta reforma quer
 * matar). `credenciais_cifradas` nunca guarda texto puro — ver
 * `src/nucleo/checkouts/segredo.ts`.
 *
 * Só a tabela nasce aqui. Nenhum código lê dela ainda: o caminho de
 * pagamento continua 100% pelo `.env`, como manda a disciplina 1 (nada de
 * virada de chave) — o novo nasce ao lado do velho.
 */
const migracao: Migracao = {
  id: '006_contas_checkout',
  descricao: 'Tabela de contas de checkout com credenciais cifradas (ainda não usada em produção)',
  up: (db) => {
    db.exec(`
      CREATE TABLE contas_checkout (
        id TEXT PRIMARY KEY,
        provedor TEXT NOT NULL,
        apelido TEXT NOT NULL,
        modo TEXT NOT NULL,
        credenciais_cifradas TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_contas_checkout_provedor ON contas_checkout (provedor, ativo)`);
  },
};

export default migracao;
