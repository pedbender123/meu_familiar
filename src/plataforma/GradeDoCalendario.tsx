'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  DOMINIOS,
  NOME_DO_DOMINIO,
  classificar,
  type Dominio,
} from '@/modulos/calendario/pontuacao';
import { COR_DO_DOMINIO, COR_DE_OURO, corDaCelula } from '@/modulos/calendario/cores';
import { fraseDoDominio } from '@/modulos/calendario/frases';
import type { DiaDoCalendario, MesDoCalendario } from '@/modulos/calendario/calendario';

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Barra de nota com a cor do domínio — reaproveitada no dia, na semana e no mês. */
function Barra({ dominio, nota }: { dominio: Dominio; nota: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-corpo text-xs text-pergaminho/55 w-[4.6rem] shrink-0">
        {NOME_DO_DOMINIO[dominio]}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-pergaminho/10 overflow-hidden">
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${nota}%`, background: COR_DO_DOMINIO[dominio] }}
        />
      </div>
      <span className="font-corpo text-xs text-pergaminho/40 w-7 text-right">{nota}</span>
    </div>
  );
}

export function GradeDoCalendario({
  mes,
  podeVoltar,
  podeAvancar,
  horaAproximada,
  alcance,
}: {
  mes: MesDoCalendario;
  podeVoltar: boolean;
  podeAvancar: boolean;
  horaAproximada: boolean;
  alcance: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const router = useRouter();
  const caminho = usePathname();

  /**
   * A navegação vai pela URL, não por estado local: o cálculo do mês acontece
   * no servidor (é ele que tem o mapa natal e o alcance do plano), então
   * trocar de mês é buscar outra página. De quebra, o mês fica no endereço —
   * dá pra voltar pelo botão do navegador e mandar o link de um mês.
   */
  function aoNavegar(passo: -1 | 1) {
    const alvo = new Date(mes.ano, mes.mes + passo, 1);
    const chave = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}`;
    setAberto(null);
    router.push(`${caminho}?mes=${chave}`, { scroll: false });
  }
  const diaAberto = mes.dias.find((d) => d.data === aberto && d.liberado);

  // A primeira linha precisa começar no dia da semana certo, senão a grade
  // não lê como calendário — lê como uma fita de quadrados.
  const vazios = mes.dias.length > 0 ? mes.dias[0].diaDaSemana : 0;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ── Navegação ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => aoNavegar(-1)}
          disabled={!podeVoltar}
          aria-label="Mês anterior"
          className="w-9 h-9 rounded-full border border-pergaminho/15 text-pergaminho/60 flex items-center justify-center hover:border-pergaminho/40 hover:text-pergaminho disabled:opacity-20 disabled:hover:border-pergaminho/15 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>

        <p className="font-display italic text-xl text-pergaminho capitalize">
          {mes.nome} <span className="text-pergaminho/40">{mes.ano}</span>
        </p>

        <button
          onClick={() => aoNavegar(1)}
          disabled={!podeAvancar}
          aria-label="Próximo mês"
          className="w-9 h-9 rounded-full border border-pergaminho/15 text-pergaminho/60 flex items-center justify-center hover:border-pergaminho/40 hover:text-pergaminho disabled:opacity-20 disabled:hover:border-pergaminho/15 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {/* ── Resumo do mês ──────────────────────────────────────────────── */}
      {mes.resumo && (
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-pergaminho/10 bg-pergaminho/[0.03]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase text-pergaminho/35">
              O mês
            </p>
            <span className="font-corpo text-xs text-pergaminho/45">
              nota {mes.resumo.geral}
            </span>
          </div>
          <p className="font-display italic text-lg leading-relaxed text-pergaminho/80">
            {mes.resumo.frase}
          </p>
          <div className="flex flex-col gap-2 pt-1">
            {DOMINIOS.map((d) => (
              <Barra key={d} dominio={d} nota={mes.resumo!.porDominio[d]} />
            ))}
          </div>
        </div>
      )}

      {/* ── A grade ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-7 gap-1.5">
          {DIAS_DA_SEMANA.map((letra, i) => (
            <span
              key={i}
              className="text-center font-corpo text-[0.58rem] tracking-wider text-pergaminho/25 pb-1"
            >
              {letra}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: vazios }, (_, i) => (
            <span key={`vazio-${i}`} aria-hidden="true" />
          ))}

          {mes.dias.map((dia) => {
            if (!dia.liberado) {
              return (
                <div
                  key={dia.data}
                  title="Disponível em um plano maior"
                  className="aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 bg-pergaminho/[0.03] border border-pergaminho/[0.06]"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pergaminho/20" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                  <span className="font-corpo text-[0.55rem] text-pergaminho/15">
                    {dia.diaDoMes}
                  </span>
                </div>
              );
            }

            const cor = corDaCelula({
              ouro: dia.ouro,
              fechado: dia.fechado,
              dominio: dia.destaque!.dominio,
              nota: dia.destaque!.nota,
            });

            return (
              <button
                key={dia.data}
                onClick={() => setAberto(aberto === dia.data ? null : dia.data)}
                aria-label={`Dia ${dia.diaDoMes}, ${NOME_DO_DOMINIO[dia.destaque!.dominio]} ${dia.destaque!.nota}`}
                style={{ background: cor.fundo, color: cor.texto }}
                className={[
                  'aspect-square rounded-lg flex items-center justify-center font-corpo text-xs transition-all',
                  aberto === dia.data ? 'ring-2 ring-pergaminho/70 scale-105' : 'hover:brightness-125',
                ].join(' ')}
              >
                {dia.diaDoMes}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legenda ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {DOMINIOS.map((d) => (
          <span key={d} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: COR_DO_DOMINIO[d] }}
            />
            <span className="font-corpo text-[0.68rem] text-pergaminho/45">
              {NOME_DO_DOMINIO[d]}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_DE_OURO }} />
          <span className="font-corpo text-[0.68rem] text-vela/80">
            Dia de ouro — sorte em tudo
          </span>
        </span>
      </div>

      {/* ── O dia aberto, em detalhe ───────────────────────────────────── */}
      {diaAberto && (
        <div className="flex flex-col gap-4 p-5 rounded-2xl border border-pergaminho/15 bg-pergaminho/[0.04]">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display italic text-xl text-pergaminho">
              {new Date(`${diaAberto.data}T12:00:00`).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            {diaAberto.ouro && (
              <span
                className="font-corpo text-[0.58rem] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full"
                style={{ background: COR_DE_OURO, color: '#171225' }}
              >
                dia de ouro
              </span>
            )}
          </div>

          <p className="font-display italic text-lg leading-relaxed text-pergaminho/85">
            {diaAberto.frase}
          </p>

          <div className="flex flex-col gap-3 pt-1 border-t border-pergaminho/10">
            {DOMINIOS.map((dominio) => {
              const nota = diaAberto.pontuacao![dominio];
              return (
                <div key={dominio} className="flex flex-col gap-1.5 pt-2">
                  <Barra dominio={dominio} nota={nota} />
                  <p className="font-corpo text-xs text-pergaminho/45 leading-relaxed pl-[5.6rem]">
                    {fraseDoDominio(diaAberto.data, dominio, classificar(nota))}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Semanas ────────────────────────────────────────────────────── */}
      {mes.semanas.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase text-pergaminho/35">
            Semana a semana
          </p>
          {mes.semanas.map((semana) => (
            <div
              key={semana.inicio}
              className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-pergaminho/10"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-corpo text-xs text-pergaminho/50">
                  {new Date(`${semana.inicio}T12:00:00`).getDate()} a{' '}
                  {new Date(`${semana.fim}T12:00:00`).getDate()}
                </span>
                <span className="font-corpo text-xs text-pergaminho/35">
                  nota {semana.resumo.geral}
                </span>
              </div>
              <p className="font-display italic text-base leading-relaxed text-pergaminho/70">
                {semana.resumo.frase}
              </p>
            </div>
          ))}
        </div>
      )}

      {alcance === 'semana' && (
        <p className="font-corpo text-xs text-pergaminho/40 leading-relaxed border-t border-pergaminho/10 pt-5">
          Os cadeados são os dias que um plano abre. Você está vendo sete;
          com a Revelação o mês inteiro se acende, e no anual, os doze meses.
        </p>
      )}

      {horaAproximada && (
        <p className="font-corpo text-xs text-pergaminho/35 leading-relaxed">
          Seu mapa está sendo lido com a hora estimada (meio-dia), então este
          calendário usa só o Sol e a Lua. Se você descobrir a hora exata do seu
          nascimento, ele fica mais fino.
        </p>
      )}
    </div>
  );
}
