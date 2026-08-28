import type { Migracao } from './tipos';

/**
 * A coluna que a 031 deveria ter criado e não criou.
 *
 * ── O que aconteceu ───────────────────────────────────────────────────────
 *
 * A 031 nasceu com uma coluna só (`split_centavos`) e ganhou a segunda
 * (`split_do_dono_centavos`) antes de subir. Em produção, porém, ela ficou
 * registrada como aplicada tendo criado apenas a primeira — e migração
 * registrada não roda de novo, então a segunda coluna nunca ia aparecer por
 * mais que o arquivo dissesse o contrário.
 *
 * É exatamente por isso que a regra do projeto é "migração aplicada não se
 * edita: corrige-se com uma nova". Editar a 031 deixaria o arquivo certo e o
 * banco errado, e a divergência só apareceria quando alguém fosse gravar o
 * repasse e o `UPDATE` falhasse — no meio de uma venda.
 *
 * A guarda por coluna faz esta migração ser inofensiva num banco que já tem
 * as duas (o de desenvolvimento, onde a 031 rodou completa).
 */
const migracao: Migracao = {
  id: '032_split_do_dono',
  descricao: 'A fatia do dono da plataforma, separada do repasse total',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('split_do_dono_centavos')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN split_do_dono_centavos INTEGER`);
    }
  },
};

export default migracao;
