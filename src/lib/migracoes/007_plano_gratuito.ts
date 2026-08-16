import type { Migracao } from './tipos';

/**
 * O plano grátis, e os três direitos que ele exige existir.
 *
 * ── Por que um plano grátis muda a estrutura, e não só a tabela de preços ──
 *
 * Até aqui, "quem não pagou" e "quem não tem direito" eram a mesma pessoa. O
 * grátis quebra isso: passa a existir gente **dentro** da plataforma com
 * acesso legítimo e limitado. Sem os três direitos abaixo, "limitado" só
 * poderia ser expresso como ausência — e a diferença entre o free e o pago
 * viraria uma coleção de telas vazias, que é o oposto do que faz alguém
 * pagar.
 *
 *   `perfilCompleto`     — o free recebe o GRUPO (três candidatos), que as 7
 *                          perguntas da isca já dão hoje; o pago recebe qual
 *                          dos três e os quatro eixos, das 26 cenas. A
 *                          fronteira já estava desenhada em `quiz/grupos.ts`
 *                          muito antes de existir plano grátis — isto só a
 *                          nomeia como direito.
 *   `oraculoNaHora`      — o free pergunta e a resposta volta em algum
 *                          momento do dia, por fila. É o que torna o grátis
 *                          sustentável numa chave de API de tier gratuito
 *                          (limite apertado por minuto, folgado por dia).
 *   `alcanceCalendario`  — o free vê a semana corrente; o pago vê o período
 *                          que comprou.
 *
 * ── Aditiva, como manda a disciplina 2 ────────────────────────────────────
 *
 * Os planos que já existem são atualizados para declarar os três campos
 * explicitamente, em vez de depender do merge de `direitosDoPlano`. O merge
 * continua lá como rede — mas o que está gravado no banco deve dizer a
 * verdade por si, senão a linha mente para quem a lê pelo SQL.
 *
 * Nada passa a ler o plano grátis por isto: não há assinatura grátis sendo
 * criada ainda, e a Fase 6 é que liga o cadastro. A linha nasce inerte.
 */
const migracao: Migracao = {
  id: '007_plano_gratuito',
  descricao: 'Plano gratuito + direitos de alcance (perfilCompleto, oraculoNaHora, alcanceCalendario)',
  up: (db) => {
    const agora = new Date().toISOString();

    /**
     * O grátis. Ele NÃO é uma versão quebrada do pago — é um produto inteiro
     * e pequeno: a pessoa descobre seu grupo, conversa com o Oráculo (com
     * espera) e vê a semana no calendário. Sai da sessão tendo recebido algo,
     * não tendo esbarrado num muro.
     */
    db.prepare(
      `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
         parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
       VALUES (@id, @nome, 0, NULL, 0, 1, 1, @direitos_json, 1, @agora, @agora)`
    ).run({
      id: 'gratuito',
      nome: 'Bruxário aberto',
      direitos_json: JSON.stringify({
        pdf: false,
        imagens: false,
        relatorioCompleto: false,
        graficos: false,
        perfilPublico: false,
        // A tiragem é o motivo de voltar amanhã — cobrar por ela mataria o
        // hábito antes dele nascer, e é o hábito que vende o resto.
        tiragemDiaria: true,
        // Poucas e sem pressa. O teto real de quanto isto custa por dia é o
        // tamanho da fila, não este número.
        perguntasOraculo: 3,
        narracaoAudio: false,
        perfilCompleto: false,
        oraculoNaHora: false,
        alcanceCalendario: 'semana',
      }),
      agora,
    });

    // Os pagos declaram os campos novos explicitamente. Ambos ganham o
    // perfil completo (é literalmente o que eles vendem hoje) e resposta na
    // hora; o alcance do calendário segue o que cada um entrega.
    const atualizar = db.prepare(
      `UPDATE planos SET direitos_json = @direitos_json, atualizado_em = @agora WHERE id = @id`
    );

    atualizar.run({
      id: 'revelacao',
      direitos_json: JSON.stringify({
        pdf: true,
        imagens: true,
        relatorioCompleto: false,
        graficos: false,
        perfilPublico: false,
        tiragemDiaria: false,
        perguntasOraculo: 0,
        narracaoAudio: false,
        perfilCompleto: true,
        oraculoNaHora: true,
        alcanceCalendario: 'nenhum',
      }),
      agora,
    });

    atualizar.run({
      id: 'completa',
      direitos_json: JSON.stringify({
        pdf: true,
        imagens: true,
        relatorioCompleto: true,
        graficos: true,
        perfilPublico: true,
        tiragemDiaria: true,
        perguntasOraculo: 10,
        narracaoAudio: true,
        perfilCompleto: true,
        oraculoNaHora: true,
        alcanceCalendario: 'mes',
      }),
      agora,
    });
  },
};

export default migracao;
