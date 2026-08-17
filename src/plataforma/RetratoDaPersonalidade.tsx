import { DESCRICAO_DOS_EIXOS, type Eixo } from '@/lib/quiz/eixos';

/**
 * O retrato em quatro eixos, do jeito que o painel inicial precisa: curto,
 * visual e legível de relance.
 *
 * ── Palavra, nunca número ─────────────────────────────────────────────────
 *
 * O z-score existe e é o que decide o familiar, mas mostrar "agência: 1.84"
 * transformaria um retrato em boletim. A régua é a mesma de
 * `descreverPerfil()` em `processar.ts` — as mesmas faixas, para a tela não
 * contradizer o texto que a pessoa já leu na revelação dela.
 */
const FAIXAS: [number, string][] = [
  [1.5, 'bem acima da média'],
  [0.5, 'acima da média'],
  [-0.5, 'na média'],
  [-1.5, 'abaixo da média'],
];

function faixaDe(z: number): string {
  return FAIXAS.find(([minimo]) => z >= minimo)?.[1] ?? 'bem abaixo da média';
}

/** Posição na barra, 0–100. ±2,5 desvios cobre praticamente todo mundo. */
function posicao(z: number): number {
  return Math.min(100, Math.max(0, ((z + 2.5) / 5) * 100));
}

const EIXOS: Eixo[] = ['agencia', 'comunhao', 'abertura', 'estabilidade'];

export function RetratoDaPersonalidade({
  eixos,
  completo,
}: {
  eixos: Partial<Record<Eixo, number>>;
  /** `false` = plano grátis, que vê o grupo mas não a medida. */
  completo: boolean;
}) {
  return (
    <div className="w-full flex flex-col gap-4">
      <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
        Seu retrato
      </p>

      <div className="flex flex-col gap-3.5">
        {EIXOS.map((eixo) => {
          const z = eixos[eixo] ?? 0;
          return (
            <div key={eixo} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display italic text-lg text-pergaminho/85">
                  {DESCRICAO_DOS_EIXOS[eixo].nome}
                </span>
                <span className="font-corpo text-xs text-pergaminho/45">
                  {completo ? faixaDe(z) : '—'}
                </span>
              </div>

              <div className="relative h-1 rounded-full bg-pergaminho/10 overflow-hidden">
                {completo ? (
                  <>
                    {/* A marca da média, pra barra ter referência. */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 w-px bg-pergaminho/25"
                      style={{ left: '50%' }}
                    />
                    <span
                      className="absolute inset-y-0 w-1.5 rounded-full bg-vela"
                      style={{ left: `calc(${posicao(z)}% - 3px)` }}
                    />
                  </>
                ) : (
                  /* Sem o perfil completo a barra existe, mas borrada: some
                     seria esconder que há mais; nítida seria dar de graça. */
                  <span className="absolute inset-0 bg-pergaminho/15 blur-[2px]" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!completo && (
        <p className="font-corpo text-xs text-pergaminho/40 leading-relaxed">
          As medidas exatas vêm com o perfil completo — as 26 cenas do ritual.
        </p>
      )}
    </div>
  );
}
