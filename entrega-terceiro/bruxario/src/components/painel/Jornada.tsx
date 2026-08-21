import Link from 'next/link';
import type { PassoDaJornada } from '@/lib/toques';

/**
 * Por onde a pessoa passou, do primeiro toque ao último.
 *
 * ── Por que o caminho inteiro, e não só a origem ──────────────────────────
 *
 * A origem é uma palavra e sempre foi insuficiente. "Instagram" não distingue
 * quem viu o vídeo 02 e comprou na hora de quem viu o 01, sumiu por dez dias,
 * voltou pelo e-mail de resgate e só fechou depois do remarketing. As duas
 * vendas custaram coisas diferentes e ensinam coisas diferentes.
 *
 * ── O tom apagado dos retornos ────────────────────────────────────────────
 *
 * Passo que não conta como aquisição aparece com opacidade menor e sem ponto
 * cheio. Não é decoração: é a diferença entre "trouxe alguém novo" e "trouxe
 * alguém de volta", e ela precisa ser visível de relance — misturar as duas é
 * o que fazia o canal e-mail parecer um canal de aquisição.
 */
const COR: Record<string, string> = {
  campanha: 'var(--ouro, #D9A441)',
  compartilhamento: 'var(--violeta, #8b7ab8)',
  remarketing: 'var(--verde, #6faa71)',
  social: '#5b9bd5',
  email: 'rgba(234,224,204,0.35)',
  direto: 'rgba(234,224,204,0.28)',
};

export function Jornada({ passos }: { passos: PassoDaJornada[] }) {
  if (passos.length === 0) {
    return (
      <p className="text-sm opacity-55 leading-relaxed">
        Sem jornada registrada. Esta pessoa chegou antes do rastreio por toque
        — o que se sabe dela é a origem gravada no pedido, e nada além disso.
      </p>
    );
  }

  return (
    <ol className="flex flex-col">
      {passos.map((p, i) => {
        const cor = COR[p.tipo] ?? 'rgba(234,224,204,0.3)';
        const ultimo = i === passos.length - 1;
        const conteudo = (
          <>
            <span className="flex flex-col items-center shrink-0" aria-hidden="true">
              <span
                className="size-2.5 rounded-full mt-1.5"
                style={{
                  background: p.conta ? cor : 'transparent',
                  border: `1.5px solid ${cor}`,
                }}
              />
              {!ultimo && (
                <span
                  className="w-px flex-1 min-h-6"
                  style={{ background: 'rgba(234,224,204,0.14)' }}
                />
              )}
            </span>
            <span className="flex flex-col gap-0.5 pb-4 min-w-0">
              <span
                className="text-sm leading-snug"
                style={{ opacity: p.conta ? 1 : 0.55 }}
              >
                {p.rotulo}
                {!p.conta && (
                  <span className="text-[10px] uppercase tracking-wider opacity-60 ml-2">
                    retorno
                  </span>
                )}
              </span>
              <span className="text-[11px] opacity-45 tabular-nums">
                {new Date(p.quando).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
                <span className="mx-1.5 opacity-50">·</span>
                <span className="font-mono">{p.caminho}</span>
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
                title="Abrir a campanha desta chegada"
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
