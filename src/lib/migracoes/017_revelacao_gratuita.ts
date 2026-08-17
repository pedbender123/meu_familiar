import type { Migracao } from './tipos';

/**
 * A virada de modelo de negócio: **a Revelação passa a ser grátis.**
 *
 * ── O que muda ────────────────────────────────────────────────────────────
 *
 * Até aqui a Revelação era o produto: R$ 9,80 para descobrir o familiar. Ela
 * deixa de ser produto e vira a **porta** — quem faz o ritual descobre o
 * familiar sem pagar, cria conta, e o que se vende passa a ser a plataforma:
 * Oráculo, Calendário e o relatório completo, por assinatura.
 *
 * A troca é deliberada: cobrar R$ 9,80 uma vez rende menos que R$ 15,90 por
 * mês, e o preço de entrada era justamente o que barrava a maior parte de
 * quem chegava. O que era receita vira aquisição.
 *
 * ── O plano gratuito recebe o que a Revelação entregava ───────────────────
 *
 * `pdf` e `imagens` entram: são o artefato da Revelação, e é ele que circula
 * no Instagram — segurá-lo mataria o motor de aquisição que a mudança inteira
 * existe para ligar.
 *
 * `relatorioCompleto`, `graficos`, `perfilPublico` e `narracaoAudio`
 * continuam FORA. É a fronteira do que se vende: o retrato longo com os
 * quatro eixos, os gráficos, a URL pública e a narração são o que a
 * assinatura abre.
 *
 * ── Quem já pagou ─────────────────────────────────────────────────────────
 *
 * Não perde nada, e isso é garantido em dois lugares independentes:
 * `direitosLegados` lê as FLAGS do produto e nunca o preço, e o plano
 * `completa` continua ativo com tudo que tinha. Ninguém desce.
 */
const migracao: Migracao = {
  id: '017_revelacao_gratuita',
  descricao: 'Revelação vira grátis; plano gratuito ganha PDF e imagens',
  up: (db) => {
    const agora = new Date().toISOString();

    // O plano `revelacao` (avulso antigo, já fora da vitrine) acompanha o
    // preço novo, pra tabela não contar uma história diferente do código.
    db.prepare(
      `UPDATE planos SET preco_centavos = 0, atualizado_em = ? WHERE id = 'revelacao'`
    ).run(agora);

    const linha = db
      .prepare(`SELECT direitos_json FROM planos WHERE id = 'gratuito'`)
      .get() as { direitos_json: string } | undefined;
    if (!linha) return;

    db.prepare(
      `UPDATE planos SET direitos_json = ?, atualizado_em = ? WHERE id = 'gratuito'`
    ).run(
      JSON.stringify({
        ...JSON.parse(linha.direitos_json),
        // O artefato da Revelação — o que a pessoa mostra pra alguém.
        pdf: true,
        imagens: true,
      }),
      agora
    );
  },
};

export default migracao;
