/**
 * O vocabulário do que uma assinatura libera — espelho exato das flags de
 * `src/lib/produtos.ts` (`Produto`), sem preço nem nome: aqui só o que muda
 * o que a pessoa PODE fazer.
 */
export interface Direitos {
  pdf: boolean;
  imagens: boolean;
  relatorioCompleto: boolean;
  graficos: boolean;
  perfilPublico: boolean;
  tiragemDiaria: boolean;
  perguntasOraculo: number;
  narracaoAudio: boolean;
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
};

/**
 * Une os direitos de várias assinaturas ativas: booleano é OU (uma só
 * assinatura que libera já libera), número é o MAIOR (a pessoa fica com a
 * cota mais generosa entre as que ela tem, nunca a soma — duas assinaturas
 * da Completa não dobram as perguntas ao Oráculo).
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
  }));
}
