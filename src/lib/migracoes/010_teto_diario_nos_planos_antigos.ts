import type { Migracao } from './tipos';

/**
 * Dá o teto DIÁRIO aos planos avulsos antigos (`revelacao`, `completa`).
 *
 * ── O erro que isto conserta ──────────────────────────────────────────────
 *
 * `perguntasOraculoPorDia` nasceu na 009. Os planos gravados antes dela não
 * têm o campo, e `direitosDoPlano` completa o que falta com `SEM_DIREITOS` —
 * ou seja, `0`. Resultado: uma assinatura da Completa daria 10 perguntas no
 * mês e **nenhuma no dia**, que na prática é nenhuma.
 *
 * "Direito novo nasce negado em plano antigo" é a regra certa e continua
 * valendo — mas um teto é o inverso de um direito: negá-lo por omissão não
 * fecha uma porta nova, fecha uma que já estava aberta. É a exceção que a
 * própria regra exige, e por isso é explícita aqui em vez de virar um `??`
 * escondido no leitor.
 *
 * ── Por que uma migração nova em vez de corrigir a 009 ────────────────────
 *
 * A 009 **já rodou em produção** — `src/lib/db.ts` executa as migrações no
 * import (por design, pra não depender de um passo manual de deploy), então
 * qualquer `npm run build` ou `npm run dev` já a aplicou. Editá-la faria o
 * banco novo divergir do banco que existe, que é exatamente o que a
 * disciplina 2 proíbe: migração aplicada não se edita, se corrige com outra.
 */
const migracao: Migracao = {
  id: '010_teto_diario_nos_planos_antigos',
  descricao: 'Teto diário de perguntas nos planos avulsos anteriores à 009',
  up: (db) => {
    const agora = new Date().toISOString();

    for (const [id, porDia] of [
      ['revelacao', 0], // nunca teve Oráculo — teto diário 0 é o correto
      ['completa', 5], // 10 no mês, até 5 num dia
    ] as const) {
      const linha = db.prepare(`SELECT direitos_json FROM planos WHERE id = ?`).get(id) as
        | { direitos_json: string }
        | undefined;
      if (!linha) continue;

      db.prepare(`UPDATE planos SET direitos_json = ?, atualizado_em = ? WHERE id = ?`).run(
        JSON.stringify({
          ...JSON.parse(linha.direitos_json),
          perguntasOraculoPorDia: porDia,
          conselhoDiario: false,
          // Compra avulsa nunca assinou nada recorrente: mandar guia por
          // e-mail seria começar a enviar o que ninguém pediu.
          guiaPorEmail: false,
        }),
        agora,
        id
      );
    }
  },
};

export default migracao;
