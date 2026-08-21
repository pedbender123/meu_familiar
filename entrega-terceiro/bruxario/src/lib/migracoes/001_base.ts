import type { Migracao } from './tipos';

/**
 * Marco zero — não cria nada.
 *
 * O schema anterior a este runner (`src/lib/db.ts:12-331`, mais os
 * `ALTER TABLE` de `garantirColunas()`) continua sendo criado por lá, e
 * SEGUE sendo criado lá. Reescrevê-lo aqui duplicaria ~300 linhas de schema
 * em dois lugares com chance real de os dois divergirem — exatamente o tipo
 * de risco que a disciplina "nada de virada de chave" existe para evitar
 * (docs/reestruturacao.md §3).
 *
 * Esta migração só existe para dar um marco: tudo que vier a partir de
 * `002` pode assumir que o schema descrito em `db.ts` já está no ar, porque
 * `001_base` roda (e é registrada como aplicada) antes de qualquer migração
 * nova rodar — ver a ordem em `src/lib/db.ts`.
 */
const migracao: Migracao = {
  id: '001_base',
  descricao: 'Marco zero — schema anterior ao runner, mantido em db.ts',
  up: () => {
    // intencionalmente vazio
  },
};

export default migracao;
