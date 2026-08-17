import type { Migracao } from './tipos';

/**
 * Separa as duas moedas do Oráculo — mensagens e leituras.
 *
 * ── O que muda, e por quê ─────────────────────────────────────────────────
 *
 * Até aqui só existia `perguntasOraculo`, e a leitura ritual dividiria essa
 * mesma cota. Isso destruiria a ideia: a pessoa gastaria tudo em mensagem
 * solta e nunca veria o ritual — que é justamente o que justifica o preço.
 *
 * **A mensagem cai para 1 por dia.** Ela é o "tirar uma dúvida sobre a
 * leitura" ou "um conselho curto", não um chat aberto. Um teto diário baixo é
 * o que mantém a mensagem barata e faz a leitura parecer rara, que é o
 * desenho descrito em `docs/oraculo.md`.
 *
 * As leituras ficam escassas de propósito. O Acompanhamento se diferencia por
 * ter o dobro delas e conselho diário — não por ter mais mensagens.
 */
const migracao: Migracao = {
  id: '015_cotas_de_leitura',
  descricao: 'Cota de leituras separada das mensagens; mensagem cai para 1/dia',
  up: (db) => {
    const agora = new Date().toISOString();

    /**
     * `leiturasPorMes` e o novo teto de mensagem por plano.
     *
     * `null` em `mensagensPorMes` = mantém o que já estava lá (é o caso dos
     * planos avulsos antigos, que ninguém compra mais e cujo comportamento
     * não deve mudar por baixo de quem já tem).
     */
    const COTAS: Record<
      string,
      { leiturasPorMes: number; mensagensPorDia: number; mensagensPorMes: number | null }
    > = {
      // O grátis ganha UMA leitura por mês. É a amostra do ritual inteiro —
      // sem ela, o free nunca vê o que está comprando.
      gratuito: { leiturasPorMes: 1, mensagensPorDia: 1, mensagensPorMes: 10 },

      revelacao_mensal: { leiturasPorMes: 2, mensagensPorDia: 1, mensagensPorMes: 30 },
      revelacao_anual: { leiturasPorMes: 2, mensagensPorDia: 1, mensagensPorMes: 30 },

      // O degrau de cima: o dobro de leituras.
      acompanhamento_mensal: { leiturasPorMes: 4, mensagensPorDia: 2, mensagensPorMes: 60 },
      acompanhamento_anual: { leiturasPorMes: 4, mensagensPorDia: 2, mensagensPorMes: 60 },

      // Avulsos antigos: ganham leitura pra não ficarem de fora do produto
      // novo, mas o teto de mensagem deles não é mexido.
      completa: { leiturasPorMes: 1, mensagensPorDia: 1, mensagensPorMes: null },
    };

    const buscar = db.prepare(`SELECT direitos_json FROM planos WHERE id = ?`);
    const gravar = db.prepare(
      `UPDATE planos SET direitos_json = ?, atualizado_em = ? WHERE id = ?`
    );

    for (const [id, cota] of Object.entries(COTAS)) {
      const linha = buscar.get(id) as { direitos_json: string } | undefined;
      if (!linha) continue;

      const direitos = JSON.parse(linha.direitos_json);
      gravar.run(
        JSON.stringify({
          ...direitos,
          leiturasPorMes: cota.leiturasPorMes,
          perguntasOraculoPorDia: cota.mensagensPorDia,
          ...(cota.mensagensPorMes !== null
            ? { perguntasOraculo: cota.mensagensPorMes }
            : {}),
        }),
        agora,
        id
      );
    }
  },
};

export default migracao;
