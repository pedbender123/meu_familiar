/**
 * O vocabulário do que uma assinatura libera.
 *
 * Nasceu como espelho exato das flags de `src/lib/produtos.ts`, e as oito
 * primeiras continuam sendo isso. As três últimas são o que o modelo de
 * assinatura precisa e o de compra avulsa nunca teve — elas descrevem
 * **alcance e velocidade**, não só sim/não, porque é aí que mora a diferença
 * entre o plano grátis e o pago.
 */
export type AlcanceCalendario = 'nenhum' | 'semana' | 'mes' | 'ano' | 'rolante';

/** Ordem de generosidade — é o que `unirDireitos` usa pra escolher o maior. */
const FORCA_DO_ALCANCE: Record<AlcanceCalendario, number> = {
  nenhum: 0,
  semana: 1,
  mes: 2,
  ano: 3,
  rolante: 4,
};

export interface Direitos {
  pdf: boolean;
  imagens: boolean;
  relatorioCompleto: boolean;
  graficos: boolean;
  perfilPublico: boolean;
  tiragemDiaria: boolean;
  perguntasOraculo: number;
  narracaoAudio: boolean;

  /**
   * O familiar exato e os quatro eixos, das 26 cenas — contra o **grupo**
   * (três candidatos) que as 7 perguntas da isca já dão de graça.
   *
   * A escada inteira do plano grátis mora aqui: o free entrega um retrato
   * que a pessoa reconhece em si e um grupo coerente com o que ela acabou de
   * responder; o pago entrega qual dos três é o dela e por quê. Ver o
   * comentário em `src/lib/quiz/grupos.ts`, que é onde essa fronteira foi
   * desenhada muito antes de existir plano grátis.
   */
  perfilCompleto: boolean;

  /**
   * `true` = a resposta do Oráculo sai na hora. `false` = entra numa fila e
   * volta em algum momento do dia.
   *
   * Não é degradação gratuita: é o que torna o plano grátis sustentável. Uma
   * chave de API gratuita costuma ter limite apertado por minuto e folgado
   * por dia — exatamente o formato que uma fila drenando devagar aproveita e
   * uma resposta síncrona desperdiça. E a espera cai bem na ficção: oráculo
   * que responde instantaneamente parece chatbot; oráculo que responde
   * "quando as cartas assentarem" parece oráculo.
   */
  oraculoNaHora: boolean;

  /** Quanto do calendário astrológico abre. Free vê a semana; o pago, o prazo que comprou. */
  alcanceCalendario: AlcanceCalendario;

  /**
   * O teto do dia, ao lado do teto do mês (`perguntasOraculo`).
   *
   * *"10 por mês, até 5 no mesmo dia"* são **dois** limites, não um. O mensal
   * é o que foi vendido; o diário impede alguém queimar o mês inteiro numa
   * madrugada de ansiedade e sumir. Protege a margem e protege a pessoa.
   */
  perguntasOraculoPorDia: number;

  /**
   * As **leituras** — o ritual longo, com espetáculos (ver `docs/oraculo.md`).
   *
   * Moeda separada de `perguntasOraculo` de propósito: são dois produtos
   * diferentes com dois custos diferentes. A mensagem é barata e diária; a
   * leitura é rara, cerimoniosa e é o que justifica o preço. Se as duas
   * dividissem a mesma cota, a pessoa gastaria tudo em mensagem e nunca
   * veria o que o plano tem de melhor.
   */
  leiturasPorMes: number;

  /** Conselho todo dia (Acompanhamento) contra semanal (o resto). */
  conselhoDiario: boolean;

  /**
   * O guia vai por e-mail, ou só existe dentro da plataforma?
   *
   * É a diferença que faz o plano pago valer sem tornar o grátis inútil: o
   * grátis entrega o mesmo conteúdo, mas só para quem entra; o pago vai
   * atrás da pessoa. Recurso idêntico, alcance diferente.
   */
  guiaPorEmail: boolean;
}

export const SEM_DIREITOS: Direitos = {
  pdf: false,
  imagens: false,
  relatorioCompleto: false,
  graficos: false,
  perfilPublico: false,
  tiragemDiaria: false,
  perguntasOraculo: 0,
  narracaoAudio: false,
  perfilCompleto: false,
  oraculoNaHora: false,
  alcanceCalendario: 'nenhum',
  perguntasOraculoPorDia: 0,
  leiturasPorMes: 0,
  conselhoDiario: false,
  guiaPorEmail: false,
};

/**
 * Une os direitos de várias assinaturas ativas: booleano é OU (uma só
 * assinatura que libera já libera), número é o MAIOR (a pessoa fica com a
 * cota mais generosa entre as que ela tem, nunca a soma — duas assinaturas
 * da Completa não dobram as perguntas ao Oráculo), e o alcance do calendário
 * é o mais longe que qualquer uma delas alcança.
 *
 * `[]` devolve `SEM_DIREITOS`: conta sem assinatura ativa não tem nada.
 */
export function unirDireitos(varios: Direitos[]): Direitos {
  if (varios.length === 0) return SEM_DIREITOS;

  return varios.reduce((acc, d) => ({
    pdf: acc.pdf || d.pdf,
    imagens: acc.imagens || d.imagens,
    relatorioCompleto: acc.relatorioCompleto || d.relatorioCompleto,
    graficos: acc.graficos || d.graficos,
    perfilPublico: acc.perfilPublico || d.perfilPublico,
    tiragemDiaria: acc.tiragemDiaria || d.tiragemDiaria,
    perguntasOraculo: Math.max(acc.perguntasOraculo, d.perguntasOraculo),
    narracaoAudio: acc.narracaoAudio || d.narracaoAudio,
    perfilCompleto: acc.perfilCompleto || d.perfilCompleto,
    oraculoNaHora: acc.oraculoNaHora || d.oraculoNaHora,
    alcanceCalendario:
      FORCA_DO_ALCANCE[acc.alcanceCalendario] >= FORCA_DO_ALCANCE[d.alcanceCalendario]
        ? acc.alcanceCalendario
        : d.alcanceCalendario,
    perguntasOraculoPorDia: Math.max(acc.perguntasOraculoPorDia, d.perguntasOraculoPorDia),
    leiturasPorMes: Math.max(acc.leiturasPorMes, d.leiturasPorMes),
    conselhoDiario: acc.conselhoDiario || d.conselhoDiario,
    guiaPorEmail: acc.guiaPorEmail || d.guiaPorEmail,
  }));
}
