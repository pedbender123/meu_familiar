import type { Migracao } from './tipos';

/**
 * A virada de modelo: de compra avulsa para assinatura.
 *
 * ── O que muda de verdade ─────────────────────────────────────────────────
 *
 * Até aqui, "Revelação" era um produto que se compra uma vez por R$ 9,80.
 * Agora é um **plano mensal de R$ 15,90**, e existe um degrau acima
 * (Acompanhamento) e uma versão anual mais barata por mês em cada um.
 *
 * Os planos antigos (`revelacao`, `completa`) NÃO são apagados nem alterados.
 * Eles continuam ativos e legíveis porque existe gente cuja assinatura aponta
 * pra eles — apagar a linha arrancaria o acesso de quem pagou. Eles saem só
 * de `publico`, o que os tira da vitrine sem tirar de ninguém o que comprou.
 * (Disciplina 2: migração é aditiva; o que morre, morre numa entrega
 * separada, depois de ninguém mais depender.)
 *
 * ── Cota de duas travas ───────────────────────────────────────────────────
 *
 * "10 por mês, até 5 no mesmo dia" são DOIS limites, não um. O mensal é o que
 * foi vendido; o diário impede alguém queimar o mês inteiro numa madrugada
 * de ansiedade e sumir. Protege a margem e protege a pessoa. O consumo em si
 * (tabela `consumo`, transação por clique) é a Fase 8 — aqui só se declara
 * quanto cada plano dá.
 *
 * ── O que ainda não está aqui ─────────────────────────────────────────────
 *
 * `conselhoDiario` e `guiaPorEmail` nascem declarados porque a escada de
 * benefícios já se desenha em cima deles (o grátis vê o conselho semanal
 * DENTRO da plataforma; quem paga recebe por e-mail), mas nenhum código os
 * lê ainda — o Oráculo é a Fase 8/9. Direito declarado antes do recurso é
 * barato; recurso lançado sem direito é o que obriga a remendar depois.
 */
const migracao: Migracao = {
  id: '009_planos_assinatura',
  descricao: 'Planos de assinatura (Revelação e Acompanhamento, mensal e anual)',
  up: (db) => {
    const agora = new Date().toISOString();

    // Os avulsos saem da vitrine, mas continuam válidos pra quem já os tem.
    db.prepare(`UPDATE planos SET publico = 0, atualizado_em = ? WHERE id IN ('revelacao','completa')`)
      .run(agora);

    const inserir = db.prepare(
      `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
         parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
       VALUES (@id, @nome, @preco_centavos, @duracao_dias, 1, @parcelas_max, 1,
         @direitos_json, 1, @agora, @agora)`
    );

    /** Tudo que os pagos têm em comum — o perfil completo e o Oráculo na hora. */
    const basePaga = {
      pdf: true,
      imagens: true,
      relatorioCompleto: true,
      graficos: true,
      perfilPublico: true,
      tiragemDiaria: true,
      narracaoAudio: true,
      perfilCompleto: true,
      oraculoNaHora: true,
      guiaPorEmail: true,
    };

    // ── Revelação: a porta de entrada paga ───────────────────────────────
    const revelacaoDireitos = {
      ...basePaga,
      perguntasOraculo: 10,
      perguntasOraculoPorDia: 5,
      conselhoDiario: false,
      alcanceCalendario: 'mes',
    };

    inserir.run({
      id: 'revelacao_mensal',
      nome: 'Revelação',
      preco_centavos: 1590,
      duracao_dias: 30,
      parcelas_max: 1,
      direitos_json: JSON.stringify(revelacaoDireitos),
      agora,
    });

    /**
     * R$ 9,90/mês cobrados de uma vez: 12 × 990 = 11880.
     * O desconto de 38% sobre o mensal é deliberado — o objetivo declarado é
     * caixa antecipado pra escalar tráfego, e R$ 118,80 hoje valem mais que
     * R$ 190,80 pingando por um ano que pode ter churn no meio.
     */
    inserir.run({
      id: 'revelacao_anual',
      nome: 'Revelação · anual',
      preco_centavos: 11880,
      duracao_dias: 365,
      parcelas_max: 12,
      direitos_json: JSON.stringify({ ...revelacaoDireitos, alcanceCalendario: 'ano' }),
      agora,
    });

    // ── Acompanhamento: o degrau de cima ─────────────────────────────────
    const acompanhamentoDireitos = {
      ...basePaga,
      perguntasOraculo: 50,
      perguntasOraculoPorDia: 5,
      // O que justifica o salto de preço não é só volume: é frequência.
      conselhoDiario: true,
      alcanceCalendario: 'mes',
    };

    inserir.run({
      id: 'acompanhamento_mensal',
      nome: 'Acompanhamento',
      preco_centavos: 3990,
      duracao_dias: 30,
      parcelas_max: 1,
      direitos_json: JSON.stringify(acompanhamentoDireitos),
      agora,
    });

    // 12 × 2990 = 35880 (R$ 29,90/mês), 25% abaixo do mensal.
    inserir.run({
      id: 'acompanhamento_anual',
      nome: 'Acompanhamento · anual',
      preco_centavos: 35880,
      duracao_dias: 365,
      parcelas_max: 12,
      direitos_json: JSON.stringify({
        ...acompanhamentoDireitos,
        alcanceCalendario: 'rolante',
      }),
      agora,
    });

    /**
     * O grátis ganha o conselho SEMANAL, mas sem e-mail: ele só existe se a
     * pessoa entrar. É a diferença que faz o plano pago valer sem tornar o
     * grátis inútil — o grátis dá o conteúdo, o pago vai atrás da pessoa.
     */
    const gratis = db.prepare(`SELECT direitos_json FROM planos WHERE id = 'gratuito'`).get() as
      | { direitos_json: string }
      | undefined;
    if (gratis) {
      db.prepare(`UPDATE planos SET direitos_json = ?, atualizado_em = ? WHERE id = 'gratuito'`).run(
        JSON.stringify({
          ...JSON.parse(gratis.direitos_json),
          perguntasOraculoPorDia: 1,
          conselhoDiario: false,
          guiaPorEmail: false,
        }),
        agora
      );
    }
  },
};

export default migracao;
