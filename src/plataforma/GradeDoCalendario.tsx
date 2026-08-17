'use client';

import { useState } from 'react';
import {
  DOMINIOS,
  NOME_DO_DOMINIO,
  type Dominio,
} from '@/modulos/calendario/pontuacao';
import type { DiaDoCalendario } from '@/modulos/calendario/calendario';

/**
 * O calendário como grade — um quadradinho por dia, cor pela nota.
 *
 * ── Por que filtro por domínio, e não tudo de uma vez ─────────────────────
 *
 * Cada dia tem quatro notas. Mostrar as quatro em cada célula daria uma grade
 * ilegível de 120 números; mostrar só a maior esconderia justamente a
 * pergunta que a pessoa veio fazer, que é sempre sobre UM assunto ("quando eu
 * viajo?", "quando eu peço aumento?").
 *
 * Então a grade responde uma pergunta por vez: escolhe-se o domínio, e a cor
 * de todo dia passa a falar dele. "Tudo" mostra o destaque de cada dia, que é
 * a visão de quem ainda não sabe o que procura.
 */
const COR_POR_CLASSE: Record<DiaDoCalendario['classe'], string> = {
  ouro: 'bg-vela text-tinta',
  bom: 'bg-vela/40 text-pergaminho',
  neutro: 'bg-pergaminho/[0.07] text-pergaminho/50',
  recolher: 'bg-violeta/25 text-pergaminho/60',
};

function classeDaNota(nota: number): DiaDoCalendario['classe'] {
  if (nota >= 70) return 'ouro';
  if (nota >= 58) return 'bom';
  if (nota >= 35) return 'neutro';
  return 'recolher';
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function GradeDoCalendario({
  dias,
  horaAproximada,
}: {
  dias: DiaDoCalendario[];
  horaAproximada: boolean;
}) {
  const [filtro, setFiltro] = useState<Dominio | 'tudo'>('tudo');
  const [aberto, setAberto] = useState<string | null>(null);

  const notaDe = (dia: DiaDoCalendario) =>
    filtro === 'tudo' ? dia.destaque.nota : dia.pontuacao[filtro];

  // Agrupa por mês para a grade não virar uma fita de 365 quadrados sem
  // referência — no plano anual isso é a diferença entre navegável e não.
  const porMes = new Map<string, DiaDoCalendario[]>();
  for (const dia of dias) {
    const [ano, mes] = dia.data.split('-');
    const chave = `${MESES[Number(mes) - 1]} de ${ano}`;
    if (!porMes.has(chave)) porMes.set(chave, []);
    porMes.get(chave)!.push(dia);
  }

  const diaAberto = dias.find((d) => d.data === aberto);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ── Filtro por domínio ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {(['tudo', ...DOMINIOS] as const).map((opcao) => (
          <button
            key={opcao}
            onClick={() => setFiltro(opcao)}
            className={[
              'font-corpo text-xs px-3.5 py-1.5 rounded-full border transition-colors',
              filtro === opcao
                ? 'border-vela/60 text-vela bg-vela/10'
                : 'border-pergaminho/15 text-pergaminho/50 hover:text-pergaminho/80',
            ].join(' ')}
          >
            {opcao === 'tudo' ? 'Tudo' : NOME_DO_DOMINIO[opcao]}
          </button>
        ))}
      </div>

      {/* ── A grade ────────────────────────────────────────────────────── */}
      {[...porMes.entries()].map(([mes, diasDoMes]) => (
        <div key={mes} className="flex flex-col gap-2">
          <p className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase text-pergaminho/35">
            {mes}
          </p>

          <div className="grid grid-cols-7 gap-1.5">
            {diasDoMes.map((dia) => {
              const nota = notaDe(dia);
              return (
                <button
                  key={dia.data}
                  onClick={() => setAberto(aberto === dia.data ? null : dia.data)}
                  aria-label={`Dia ${dia.diaDoMes}, nota ${nota}`}
                  className={[
                    'aspect-square rounded-lg flex items-center justify-center font-corpo text-xs transition-all',
                    COR_POR_CLASSE[classeDaNota(nota)],
                    aberto === dia.data ? 'ring-2 ring-vela scale-105' : 'hover:brightness-125',
                  ].join(' ')}
                >
                  {dia.diaDoMes}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── O dia aberto ───────────────────────────────────────────────── */}
      {diaAberto && (
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-vela/25 bg-vela/[0.04]">
          <p className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase text-pergaminho/40">
            {new Date(`${diaAberto.data}T12:00:00`).toLocaleDateString('pt-BR', {
              day: 'numeric',
              month: 'long',
            })}
          </p>

          <div className="flex flex-col gap-2.5">
            {DOMINIOS.map((dominio) => (
              <div key={dominio} className="flex items-center gap-3">
                <span className="font-corpo text-xs text-pergaminho/55 w-20 shrink-0">
                  {NOME_DO_DOMINIO[dominio]}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-pergaminho/10 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-vela"
                    style={{ width: `${diaAberto.pontuacao[dominio]}%` }}
                  />
                </div>
                <span className="font-corpo text-xs text-pergaminho/40 w-7 text-right">
                  {diaAberto.pontuacao[dominio]}
                </span>
              </div>
            ))}
          </div>
        </div>
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
