import type { Migracao } from './tipos';

/**
 * Quem mais pode abrir o painel — e só olhar.
 *
 * ── O que existia antes ───────────────────────────────────────────────────
 *
 * Um endereço, em `ADMIN_EMAIL`. A tela de entrar não tinha campo nenhum, e
 * era isso que a tornava inatacável: sem caixa de e-mail não há para onde
 * apontar o link, sem senha não há o que forçar, sem lista não há quem
 * enumerar.
 *
 * ── O que muda, e o que é preservado ──────────────────────────────────────
 *
 * Agora existe um campo de e-mail, porque mais gente precisa ver os números.
 * A propriedade que não pode se perder é a de não vazar quem está na lista —
 * por isso a rota de acesso responde **exatamente igual** para endereço na
 * lista e fora dela. Continua não havendo quem enumerar; a diferença é que
 * agora existem várias caixas de entrada válidas em vez de uma.
 *
 * ── O dono NÃO está nesta tabela ──────────────────────────────────────────
 *
 * E é de propósito. O pedido era "meu e-mail não pode sair da whitelist"; a
 * forma mais forte de garantir isso não é uma trava contra apagar a linha, é
 * **não ter linha**. O dono vem de `ADMIN_EMAIL`, no ambiente. Nenhum DELETE,
 * nenhum bug de interface e nenhuma consulta errada consegue tirá-lo, porque
 * não há nada ali para tirar.
 *
 * Pela mesma razão, `papel` só admite `leitor`: o poder de editar não é um
 * valor de coluna que alguém possa mudar, é uma propriedade de ser o
 * endereço do ambiente. Um `UPDATE` malicioso nesta tabela não promove
 * ninguém.
 */
const migracao: Migracao = {
  id: '021_equipe_do_painel',
  descricao: 'Lista de e-mails que podem ver o painel (somente leitura)',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS painel_acessos (
        email      TEXT PRIMARY KEY,
        papel      TEXT NOT NULL DEFAULT 'leitor' CHECK (papel = 'leitor'),
        nota       TEXT,
        criado_por TEXT NOT NULL,
        criado_em  TEXT NOT NULL,
        ultimo_acesso_em TEXT
      )
    `);
  },
};

export default migracao;
