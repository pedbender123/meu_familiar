'use client';

import { RodaDeSelecao, ALTURA_ITEM } from './RodaDeSelecao';

/**
 * A hora de nascimento, no mesmo disco da data.
 *
 * ── Por que ela é pedida mesmo sendo opcional ─────────────────────────────
 *
 * A hora refina a Lua de verdade — é a diferença entre saber o signo lunar e
 * chutá-lo pelo dia. Mas quem não sabe não pode ficar travado aqui: a saída
 * "não lembro" é tão visível quanto o continuar, e escolhê-la não penaliza
 * nada além de um pedaço do medidor.
 *
 * Esconder a saída para forçar o preenchimento é o padrão escuro óbvio deste
 * passo, e ele custa caro: quem não sabe a hora inventa um número, e a leitura
 * sai pior do que sairia sem nada.
 */
export function RodaDeHora({
  hora,
  minuto,
  onChange,
}: {
  hora: number;
  minuto: number;
  onChange: (v: { hora: number; minuto: number }) => void;
}) {
  return (
    <div className="relative flex">
      <div
        aria-hidden="true"
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-2xl pointer-events-none z-0"
        style={{
          height: ALTURA_ITEM,
          background:
            'linear-gradient(to right, transparent, color-mix(in srgb, var(--ouro-velho) 14%, transparent) 18%, color-mix(in srgb, var(--ouro-velho) 14%, transparent) 82%, transparent)',
          boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ouro-velho) 26%, transparent)',
        }}
      />
      <div className="relative z-10 flex w-full">
        <RodaDeSelecao
          aria="Hora"
          opcoes={Array.from({ length: 24 }, (_, i) => ({
            valor: i,
            rotulo: String(i).padStart(2, '0'),
          }))}
          valor={hora}
          onChange={(v) => onChange({ hora: v, minuto })}
        />
        <RodaDeSelecao
          aria="Minuto"
          opcoes={Array.from({ length: 60 }, (_, i) => ({
            valor: i,
            rotulo: String(i).padStart(2, '0'),
          }))}
          valor={minuto}
          onChange={(v) => onChange({ hora, minuto: v })}
        />
      </div>
    </div>
  );
}
