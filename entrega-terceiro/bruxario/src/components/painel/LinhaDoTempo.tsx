import Link from 'next/link';
import type { CategoriaDoPasso, PassoDaLinha } from '@/nucleo/linha-do-tempo';

/**
 * A linha de vida da venda inteira — marketing, funil, sistema, pixel e
 * Sentinela, na mesma linha do tempo. Mesmo desenho visual de `Jornada.tsx`
 * (ponto + traço conectando), estendido para as cinco categorias que
 * `linha-do-tempo.ts` junta.
 */
const COR: Record<CategoriaDoPasso, string> = {
  marketing: 'var(--ouro, #D9A441)',
  funil: '#5b9bd5',
  sistema: 'rgba(234,224,204,0.55)',
  pixel: 'var(--violeta, #8b7ab8)',
  anomalia: '#D97A7A',
};

const NOME_DA_CATEGORIA: Record<CategoriaDoPasso, string> = {
  marketing: 'marketing',
  funil: 'funil',
  sistema: 'sistema',
  pixel: 'pixel',
  anomalia: 'sentinela',
};

export function LinhaDoTempo({ passos }: { passos: PassoDaLinha[] }) {
  if (passos.length === 0) {
    return (
      <p className="text-sm opacity-55 leading-relaxed">
        Sem rastro nenhum para este pedido — provavelmente criado antes do
        rastreio existir, ou por script/painel direto.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {passos.map((p, i) => {
        const cor = COR[p.categoria];
        const ultimo = i === passos.length - 1;
        const conteudo = (
          <>
            <span className="flex flex-col items-center shrink-0" aria-hidden="true">
              <span
                className="size-2.5 rounded-full mt-1.5"
                style={{ background: cor, border: `1.5px solid ${cor}` }}
              />
              {!ultimo && (
                <span
                  className="w-px flex-1 min-h-6"
                  style={{ background: 'rgba(234,224,204,0.14)' }}
                />
              )}
            </span>
            <span className="flex flex-col gap-0.5 pb-4 min-w-0">
              <span className="text-sm leading-snug">
                {p.rotulo}
                <span
                  className="text-[10px] uppercase tracking-wider opacity-50 ml-2"
                  style={{ color: cor }}
                >
                  {NOME_DA_CATEGORIA[p.categoria]}
                </span>
              </span>
              {p.detalhe && (
                <span className="text-[11px] opacity-50 leading-snug">{p.detalhe}</span>
              )}
              <span className="text-[11px] opacity-45 tabular-nums">
                {new Date(p.quando).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </span>
            </span>
          </>
        );

        return (
          <li key={`${p.quando}-${i}`}>
            {p.destino ? (
              <Link
                href={p.destino}
                className="flex gap-3 rounded-lg -mx-2 px-2 hover:bg-pergaminho/5 transition"
              >
                {conteudo}
              </Link>
            ) : (
              <div className="flex gap-3 -mx-2 px-2">{conteudo}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
