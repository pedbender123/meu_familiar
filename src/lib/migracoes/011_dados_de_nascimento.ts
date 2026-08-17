import type { Migracao } from './tipos';

/**
 * Os dados de nascimento como colunas próprias — o que o Calendário (Fase 7)
 * precisa e hoje não existe em lugar nenhum consultável.
 *
 * ── O que existe hoje, e por que não serve ────────────────────────────────
 *
 * `pedidos` guarda `signo_sol` e `signo_lua` **já calculados**, e a data crua
 * fica enterrada dentro de `respostas_json`. Dá pra achar com um LIKE, mas:
 * é dado de PESSOA, não de pedido (quem compra duas vezes não nasce duas
 * vezes), e mapa natal precisa de hora e de LUGAR — e lugar nunca foi
 * perguntado a ninguém.
 *
 * Sem cidade não há ascendente nem casas astrológicas. Então em vez de o
 * Calendário nascer capenga, a conta passa a saber que está incompleta e a
 * pedir o que falta — ver `src/nucleo/perfil-astral.ts`.
 *
 * `preenchido_em` separado dos campos: distingue "nunca perguntamos" de
 * "perguntamos e a pessoa pulou", que são situações diferentes na hora de
 * decidir se insiste.
 */
const migracao: Migracao = {
  id: '011_dados_de_nascimento',
  descricao: 'Dados de nascimento na conta (data, hora, cidade) para o mapa natal',
  up: (db) => {
    /**
     * `contas` é criada por `src/lib/autenticacao.ts`, que só é importado
     * DEPOIS de `db.ts` rodar as migrações — então num banco novo a tabela
     * ainda não existe aqui, e o `ALTER` quebraria o boot inteiro.
     *
     * Banco novo não precisa desta migração: as colunas já nascem no
     * `CREATE TABLE` de `autenticacao.ts`. Esta migração existe só para os
     * bancos que foram criados antes delas.
     */
    const existe = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'contas'`)
      .get();
    if (!existe) return;

    const colunas = (db.prepare(`PRAGMA table_info(contas)`).all() as { name: string }[]).map(
      (c) => c.name
    );

    const novas: [string, string][] = [
      ['nascimento_data', 'TEXT'],
      ['nascimento_hora', 'TEXT'],
      ['nascimento_cidade', 'TEXT'],
      ['nascimento_lat', 'REAL'],
      ['nascimento_lon', 'REAL'],
      ['nascimento_preenchido_em', 'TEXT'],
      // Quando pedimos por e-mail — pra insistir sem virar spam.
      ['nascimento_pedido_em', 'TEXT'],
    ];

    for (const [nome, tipo] of novas) {
      if (!colunas.includes(nome)) {
        db.exec(`ALTER TABLE contas ADD COLUMN ${nome} ${tipo}`);
      }
    }
  },
};

export default migracao;
