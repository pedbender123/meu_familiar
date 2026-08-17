import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { historicoDaConta } from '@/modulos/oraculo/arquivo';
import type { LeituraDoOraculo } from '@/modulos/oraculo/leitura';
import type { ResultadoDoEspetaculo } from '@/modulos/oraculo/espetaculos';

/**
 * Tudo que o Oráculo já te disse.
 *
 * ── Por que isto não é "bônus", é parte do produto ────────────────────────
 *
 * Uma leitura que só existe no instante em que aparece é entretenimento; uma
 * que fica guardada e pode ser relida meses depois é registro — e é o
 * registro que faz a assinatura valer mais que uma consulta avulsa. A pessoa
 * volta pra conferir o que foi dito antes de uma decisão, e é aí que ela vê
 * que o Oráculo acertou (ou não) — o que é honesto dos dois jeitos.
 *
 * As cartas ficam junto do texto porque a leitura sem elas perde metade: o
 * ritual É a leitura, não a embalagem dela.
 */
function formatar(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function HistoricoDoOraculo() {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const conta = buscarConta(sessao.email);
  const registros = conta ? historicoDaConta(conta.id, 50) : [];

  if (registros.length === 0) {
    return (
      <section className="w-full max-w-lg flex flex-col items-center gap-6 pt-10 text-center">
        <p className="font-display italic text-xl text-pergaminho/80 max-w-[28ch] leading-relaxed">
          Ainda não conversamos.
        </p>
        <p className="font-corpo font-light text-sm text-pergaminho/45 max-w-[32ch] leading-relaxed">
          O que você perguntar fica guardado aqui — para reler quando precisar
          lembrar do que foi dito.
        </p>
        <Link
          href="/conta/oraculo"
          className="font-corpo text-sm px-6 py-2.5 rounded-full border border-vela/45 text-vela hover:bg-vela/10 transition-colors"
        >
          Falar com o Oráculo
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl flex flex-col gap-8 pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
            O que já foi dito
          </p>
          <h1 className="font-display italic text-2xl text-pergaminho leading-tight">
            Suas consultas
          </h1>
        </div>
        <Link
          href="/conta/oraculo"
          className="font-corpo text-sm text-vela hover:brightness-125 transition shrink-0"
        >
          nova →
        </Link>
      </div>

      <div className="flex flex-col gap-5">
        {registros.map((registro) => {
          const ehLeitura = registro.tipo === 'leitura';
          const resposta = JSON.parse(registro.resposta_json);
          const espetaculos: ResultadoDoEspetaculo[] = registro.espetaculos_json
            ? JSON.parse(registro.espetaculos_json)
            : [];

          return (
            <article
              key={registro.id}
              className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border"
              style={{
                borderColor: registro.dia_de_ouro
                  ? 'rgba(217,164,65,0.35)'
                  : 'rgba(234,224,204,0.1)',
                background: registro.dia_de_ouro
                  ? 'linear-gradient(160deg, rgba(217,164,65,0.08), rgba(234,224,204,0.02))'
                  : 'rgba(234,224,204,0.02)',
              }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-corpo text-[0.58rem] tracking-[0.2em] uppercase text-pergaminho/35">
                  {formatar(registro.criado_em)}
                </span>

                <span className="flex items-center gap-2">
                  {registro.dia_de_ouro === 1 && (
                    <span
                      className="font-corpo text-[0.52rem] tracking-[0.14em] uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--vela)', color: '#171225' }}
                    >
                      dia de ouro
                    </span>
                  )}
                  <span
                    className={[
                      'font-corpo text-[0.58rem] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full border',
                      ehLeitura
                        ? 'border-vela/40 text-vela'
                        : 'border-pergaminho/20 text-pergaminho/45',
                    ].join(' ')}
                  >
                    {ehLeitura ? 'leitura' : 'mensagem'}
                  </span>
                </span>
              </div>

              <p className="font-corpo font-light text-sm text-pergaminho/55 italic">
                &ldquo;{registro.pergunta}&rdquo;
              </p>

              {ehLeitura ? (
                <>
                  {espetaculos.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {espetaculos
                        .flatMap((e) => e.simbolos)
                        .map((s) => (
                          <span
                            key={s.nome}
                            className="font-corpo text-[0.62rem] px-2.5 py-1 rounded-full border"
                            style={{
                              borderColor: s.dourado
                                ? 'var(--vela)'
                                : 'rgba(234,224,204,0.18)',
                              color: s.dourado ? 'var(--vela)' : 'rgb(234 224 204 / 0.55)',
                            }}
                          >
                            {s.nome}
                          </span>
                        ))}
                    </div>
                  )}

                  <p className="font-display italic text-base leading-relaxed text-pergaminho/80 pt-1">
                    {(resposta as LeituraDoOraculo).conselho}
                  </p>

                  <details className="group">
                    <summary className="font-corpo text-xs text-pergaminho/40 hover:text-pergaminho/70 cursor-pointer transition-colors list-none">
                      ler a leitura inteira
                    </summary>

                    <div className="flex flex-col gap-4 pt-4">
                      <p className="font-display italic text-base leading-relaxed text-pergaminho/75">
                        {(resposta as LeituraDoOraculo).abertura}
                      </p>

                      {(resposta as LeituraDoOraculo).simbolos.map((s) => (
                        <div
                          key={s.simbolo}
                          className="flex flex-col gap-1 pl-3 border-l border-pergaminho/15"
                        >
                          <span className="font-display italic text-sm text-pergaminho/85">
                            {s.simbolo}
                          </span>
                          <p className="font-corpo font-light text-xs leading-relaxed text-pergaminho/60">
                            {s.oQueDiz}
                          </p>
                        </div>
                      ))}

                      <p className="font-display italic text-sm leading-relaxed text-pergaminho/50">
                        {(resposta as LeituraDoOraculo).fechamento}
                      </p>
                    </div>
                  </details>
                </>
              ) : (
                <p className="font-display italic text-base leading-relaxed text-pergaminho/80">
                  {(resposta as { resposta: string }).resposta}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
