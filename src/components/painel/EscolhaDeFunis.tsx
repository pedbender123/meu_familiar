'use client';

import { FUNIS, type FunilId } from '@/lib/funis';

/**
 * Quais páginas de venda esta campanha usa.
 *
 * ── Uma ou mais, e a diferença é o teste ──────────────────────────────────
 *
 * Marcar uma: todo mundo que chegar por esta campanha vê aquela página.
 * Marcar duas ou três: o tráfego é dividido entre elas e vira teste A/B —
 * cada pessoa sorteia uma vez e fica nela.
 *
 * O link do anúncio é o mesmo nos dois casos (`bruxario.com.br/?c=xx`). Trocar
 * o que ele mostra é mexer aqui, não republicar o anúncio.
 */
export function EscolhaDeFunis({
  valor,
  onChange,
}: {
  valor: FunilId[];
  onChange: (v: FunilId[]) => void;
}) {
  const lista = Object.values(FUNIS);

  function alternar(id: FunilId) {
    onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        Páginas de venda desta campanha
      </span>

      {lista.map((f) => {
        const ativo = valor.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => alternar(f.id)}
            aria-pressed={ativo}
            className={[
              'flex items-start gap-3 text-left rounded-lg px-3 py-2.5 border transition',
              ativo
                ? 'border-vela/50 bg-vela/10'
                : 'border-pergaminho/15 hover:border-pergaminho/30',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'flex items-center justify-center size-4 rounded shrink-0 border mt-0.5 transition',
                ativo ? 'border-vela bg-vela text-tinta' : 'border-pergaminho/30',
              ].join(' ')}
            >
              {ativo && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              )}
            </span>
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="font-corpo text-xs text-pergaminho">{f.nome}</span>
              <span className="font-corpo text-[11px] leading-snug text-pergaminho/45">
                {f.aposta}
              </span>
            </span>
          </button>
        );
      })}

      <p className="font-corpo text-[11px] leading-relaxed text-pergaminho/40 mt-1">
        {valor.length === 0
          ? 'Nenhuma marcada — a campanha usa a landing padrão, com as 26 cenas.'
          : valor.length === 1
            ? `Todo mundo desta campanha vê "${FUNIS[valor[0]].nome}".`
            : `Teste A/B entre ${valor.length} páginas: o tráfego é dividido por igual e cada pessoa fica na que sorteou.`}
      </p>
    </div>
  );
}
