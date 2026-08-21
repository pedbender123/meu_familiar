'use client';

/**
 * O progresso do ritual longo, como um fio de luz que se preenche.
 *
 * ── Por que substituiu o círculo de sigilo ────────────────────────────────
 *
 * O anterior desenhava vinte e seis nós numa roda e ia acendendo um por
 * resposta. A intenção era boa — dizer "está pela metade" no vocabulário do
 * produto, sem número. O efeito foi outro: vinte e seis pontos apagados são
 * um mapa explícito de quanto falta, e um mapa de quanto falta no começo de
 * um formulário longo é exatamente o que faz alguém desistir antes da
 * segunda pergunta.
 *
 * Um fio dá a mesma informação de relance e não conta nada. Não há como
 * olhar para ele e calcular "faltam dezenove".
 */
export function LinhaDeProgresso({
  total,
  respondidas,
}: {
  total: number;
  respondidas: number;
}) {
  const fracao = total > 0 ? Math.min(1, respondidas / total) : 0;

  return (
    <div
      className="w-full max-w-[15rem] h-px rounded-full overflow-hidden"
      style={{ background: 'rgba(234,224,204,0.14)' }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={respondidas}
      aria-label="Progresso do ritual"
    >
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{
          width: `${fracao * 100}%`,
          background:
            'linear-gradient(90deg, rgba(217,164,65,0.35), var(--vela))',
          boxShadow: '0 0 8px rgba(217,164,65,0.5)',
        }}
      />
    </div>
  );
}
