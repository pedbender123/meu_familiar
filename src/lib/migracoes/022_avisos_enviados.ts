import type { Migracao } from './tipos';

/**
 * O livro-caixa dos avisos automáticos: quem recebeu o quê, e quando.
 *
 * ── Por que uma tabela genérica e não uma coluna por aviso ────────────────
 *
 * `pedidos.lembrete_em` e `pedidos.acesso_gratis_em` resolveram os dois
 * primeiros do jeito mais simples possível, e estava certo enquanto eram
 * dois. A partir do terceiro o padrão cobra: cada automação nova pediria uma
 * coluna nova, numa tabela que já é larga, para guardar um `datetime` e nada
 * mais — e as automações que não são *sobre um pedido* (cota do mês, dia de
 * ouro, resumo do dono) não teriam onde morar.
 *
 * ── A chave é (tipo, destinatário, janela) ────────────────────────────────
 *
 * `janela` é o que torna a mesma tabela útil para avisos de frequências
 * diferentes sem lógica especial em cada script:
 *
 *  - dia de ouro     → `'2026-08-19'`  (um por dia, no máximo)
 *  - cota renovada   → `'2026-08'`     (um por mês)
 *  - resumo do dono  → `'2026-08-19'`
 *
 * A PRIMARY KEY composta faz o banco recusar a duplicata em vez de o script
 * precisar lembrar de conferir. Cron que roda de hora em hora não manda o
 * mesmo aviso doze vezes porque não consegue, não porque alguém escreveu um
 * `if` — e é assim que uma caixa de entrada não vira motivo de spam.
 */
const migracao: Migracao = {
  id: '022_avisos_enviados',
  descricao: 'Registro de avisos automáticos, com trava de repetição por janela',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS avisos_enviados (
        tipo         TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        janela       TEXT NOT NULL,
        criado_em    TEXT NOT NULL,
        PRIMARY KEY (tipo, destinatario, janela)
      )
    `);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_avisos_tipo_data
         ON avisos_enviados (tipo, criado_em)`
    );
  },
};

export default migracao;
