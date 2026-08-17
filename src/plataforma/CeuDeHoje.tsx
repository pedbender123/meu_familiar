import Link from 'next/link';
import type { CeuDoDia } from '@/nucleo/ceu-do-dia';
import {
  DOMINIOS,
  NOME_DO_DOMINIO,
  type PontuacaoDoDia,
} from '@/modulos/calendario/pontuacao';
import { COR_DO_DOMINIO, COR_DE_OURO } from '@/modulos/calendario/cores';
import { LuaDesenhada } from './LuaDesenhada';

/**
 * O bloco do dia, na página inicial.
 *
 * ── O que ele deixou de ser ───────────────────────────────────────────────
 *
 * Nasceu mostrando só a fase da lua e uma frase de clima — informação que não
 * é sobre a pessoa, e que portanto não dá motivo real de voltar. Agora ele é
 * a **leitura de hoje**: as quatro notas do dia tiradas do mapa natal dela,
 * a frase daquele dia, e a lua desenhada na fase de verdade.
 *
 * As notas vêm prontas de quem chama (é a mesma conta do Calendário, feita
 * uma vez no servidor) — este componente não calcula nada. Quem não tem
 * direito ao calendário recebe `pontuacao: null` e vê só a lua e o clima, que
 * é a versão honesta do bloco para quem não paga: bonita, verdadeira e
 * visivelmente menor.
 */
export function CeuDeHoje({
  ceu,
  data,
  pontuacao,
  frase,
  ouro,
  temCalendario,
}: {
  ceu: CeuDoDia;
  data: string;
  pontuacao: PontuacaoDoDia | null;
  frase: string | null;
  ouro: boolean;
  temCalendario: boolean;
}) {
  return (
    <div
      className="relative flex flex-col gap-5 p-5 sm:p-6 rounded-2xl border overflow-hidden"
      style={{
        borderColor: ouro ? 'rgba(217,164,65,0.4)' : 'rgba(234,224,204,0.1)',
        background: ouro
          ? 'linear-gradient(160deg, rgba(217,164,65,0.13), rgba(234,224,204,0.02))'
          : 'rgba(234,224,204,0.03)',
      }}
    >
      {/* ── Cabeçalho: lua + data ──────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <LuaDesenhada grausDaFase={ceu.grausDaFase} tamanho={54} />

        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
            Hoje <span className="text-pergaminho/20">· {data}</span>
          </p>
          <p className="font-display italic text-xl text-pergaminho/90 leading-tight">
            {ceu.faseNome} em {ceu.luaEm}
          </p>
        </div>

        {ouro && (
          <span
            className="ml-auto self-start font-corpo text-[0.55rem] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full shrink-0"
            style={{ background: COR_DE_OURO, color: '#171225' }}
          >
            dia de ouro
          </span>
        )}
      </div>

      {/* ── A leitura do dia ───────────────────────────────────────────── */}
      <p className="font-display italic text-lg leading-relaxed text-pergaminho/85">
        {frase ?? ceu.clima}
      </p>

      {/* ── As quatro notas ────────────────────────────────────────────── */}
      {pontuacao && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          {DOMINIOS.map((dominio) => (
            <div key={dominio} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-corpo text-[0.68rem] text-pergaminho/55">
                  {NOME_DO_DOMINIO[dominio]}
                </span>
                <span className="font-corpo text-[0.68rem] text-pergaminho/35">
                  {pontuacao[dominio]}
                </span>
              </div>
              <div className="h-1 rounded-full bg-pergaminho/10 overflow-hidden">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${pontuacao[dominio]}%`,
                    background: COR_DO_DOMINIO[dominio],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {ceu.luaEmCasa && (
        <p className="font-corpo text-xs text-vela/85 leading-relaxed border-t border-vela/15 pt-3.5">
          A Lua voltou para o signo onde estava quando você nasceu. Isso
          acontece uma vez por mês, e costuma ser o dia em que tudo pesa mais.
        </p>
      )}

      {temCalendario && (
        <Link
          href="/conta/calendario"
          className="font-corpo text-sm text-vela hover:brightness-125 transition self-start"
        >
          Ver o mês inteiro →
        </Link>
      )}
    </div>
  );
}
