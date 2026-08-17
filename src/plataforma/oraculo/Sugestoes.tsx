'use client';

/**
 * Os atalhos que ensinam a diferença entre mensagem e leitura.
 *
 * ── Por que botões prontos, e não só o campo de texto ─────────────────────
 *
 * Duas moedas com nomes parecidos ("mensagem", "leitura") são confusas por
 * escrito e óbvias por exemplo. "Tem algum conselho pra mim hoje?" contra
 * "Faça uma leitura sobre o meu amor" ensina a diferença em dois segundos,
 * sem ninguém ler regra nenhuma.
 *
 * E resolve a página em branco: campo vazio num produto novo é o momento em
 * que a pessoa não sabe o que pedir e fecha a aba.
 */
export interface Sugestao {
  texto: string;
  tipo: 'mensagem' | 'leitura';
}

export const SUGESTOES: Sugestao[] = [
  { texto: 'Tem algum conselho para mim hoje?', tipo: 'mensagem' },
  { texto: 'Como está o meu dia?', tipo: 'mensagem' },
  { texto: 'Quero uma leitura sobre o meu amor', tipo: 'leitura' },
  { texto: 'Pode fazer uma leitura geral?', tipo: 'leitura' },
];

export function Sugestoes({
  aoEscolher,
  podeLeitura,
  podeMensagem,
}: {
  aoEscolher: (s: Sugestao) => void;
  podeLeitura: boolean;
  podeMensagem: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {SUGESTOES.map((sugestao) => {
        const ehLeitura = sugestao.tipo === 'leitura';
        const liberado = ehLeitura ? podeLeitura : podeMensagem;

        return (
          <button
            key={sugestao.texto}
            onClick={() => aoEscolher(sugestao)}
            disabled={!liberado}
            className={[
              'group relative font-corpo text-xs px-4 py-2.5 rounded-full border transition-all overflow-hidden',
              'disabled:opacity-30 disabled:cursor-not-allowed',
              ehLeitura
                ? 'border-vela/50 text-vela hover:bg-vela/10 hover:border-vela/80'
                : 'border-pergaminho/20 text-pergaminho/65 hover:border-pergaminho/45 hover:text-pergaminho',
            ].join(' ')}
          >
            {/*
              O brilho que atravessa — só nos botões de leitura. É o que
              diferencia as duas moedas antes de a pessoa ler o texto: uma
              delas se move, a outra não.
            */}
            {ehLeitura && liberado && (
              <span
                aria-hidden="true"
                className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, rgba(217,164,65,0.35), transparent)',
                }}
              />
            )}

            <span className="relative flex items-center gap-1.5">
              {ehLeitura && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <path d="M12 2l1.9 6.1H20l-4.9 3.8 1.9 6.1-5-3.8-5 3.8 1.9-6.1L4 8.1h6.1z" />
                </svg>
              )}
              {sugestao.texto}
            </span>
          </button>
        );
      })}
    </div>
  );
}
