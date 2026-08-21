'use client';

import type { ReactNode } from 'react';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { Icone, type NomeDoIcone } from './Icone';

/**
 * A moldura de cada passo do funil longo.
 *
 * ── A divisão entre o quarto e o papel ────────────────────────────────────
 *
 * A barra de progresso e o botão principal ficam FORA do pergaminho; a
 * pergunta e as opções ficam dentro. Não é decoração: o papel é o objeto
 * mágico e tudo que é maquinaria de site (voltar, progresso, "continuar") em
 * cima dele quebra a ilusão que o produto inteiro vende.
 *
 * ── A barra mostra fração, não contagem ───────────────────────────────────
 *
 * "07/12" diz quanto falta sem exigir que a pessoa conte. O funil de sete
 * perguntas esconde o número de propósito — aqui é o contrário, porque um
 * funil longo sem sinal de fim é onde as pessoas desistem achando que nunca
 * acaba.
 */
export function PassoDoRitual({
  passo,
  total,
  onVoltar,
  titulo,
  subtitulo,
  children,
  acao,
}: {
  passo: number;
  total: number;
  onVoltar?: () => void;
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  /** Botão principal, renderizado fora da folha. */
  acao?: ReactNode;
}) {
  return (
    <div className="w-full max-w-xl flex flex-col gap-5 anima-surgir">
      <div className="flex items-center gap-4">
        {onVoltar ? (
          <button
            onClick={onVoltar}
            aria-label="Voltar"
            className="text-pergaminho/45 hover:text-vela transition text-2xl leading-none -mt-1"
          >
            &#8249;
          </button>
        ) : (
          <span className="w-3" />
        )}
        <div className="flex-1 h-px bg-pergaminho/12 relative">
          <div
            className="absolute inset-y-0 left-0 bg-vela transition-all duration-500"
            style={{ width: `${Math.min(100, (passo / total) * 100)}%` }}
          />
        </div>
        <span className="font-corpo text-[0.7rem] tracking-[0.16em] text-pergaminho/40 tabular-nums">
          {String(passo).padStart(2, '0')}/{total}
        </span>
      </div>

      <FolhaPergaminho>
        <div className="flex flex-col gap-6 self-stretch">
          <div className="text-center">
            <h2 className="font-display italic text-2xl sm:text-3xl leading-[1.15] text-escrita text-balance">
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-3 font-corpo font-light text-[0.9rem] leading-relaxed text-escrita-corpo/80 max-w-[30ch] mx-auto">
                {subtitulo}
              </p>
            )}
          </div>
          {children}
        </div>
      </FolhaPergaminho>

      {acao}
    </div>
  );
}

/** O botão principal, sempre fora do pergaminho. */
export function BotaoDoRitual({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="self-stretch sm:self-center sm:min-w-[18rem] bg-vela text-tinta font-corpo font-medium text-[1.05rem] px-9 py-4 rounded-full hover:brightness-110 active:scale-[0.985] transition-all disabled:opacity-40 disabled:active:scale-100"
      style={{ boxShadow: '0 8px 30px -12px color-mix(in srgb, var(--vela) 70%, transparent)' }}
    >
      {children}
    </button>
  );
}

/**
 * Lista de escolha única. Escolher já avança — um clique a menos por passo,
 * e num funil de doze passos isso são doze cliques poupados.
 */
export function Escolha({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { valor: string; rotulo: string; icone?: NomeDoIcone }[];
  valor?: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          onClick={() => onEscolher(o.valor)}
          aria-pressed={valor === o.valor}
          className={[
            'flex items-center gap-3.5 text-left font-corpo rounded-2xl px-5 py-4 border transition-all duration-200',
            'text-[1.02rem] leading-snug',
            valor === o.valor
              ? 'border-ouro-velho bg-ouro-velho/12 text-escrita'
              : 'border-escrita/18 text-escrita-corpo hover:border-ouro-velho/55 hover:bg-ouro-velho/5',
          ].join(' ')}
        >
          {o.icone && (
            <span className="text-ouro-velho shrink-0">
              <Icone nome={o.icone} tamanho={24} />
            </span>
          )}
          <span>{o.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Escolha em cartões lado a lado, com o ícone num disco.
 *
 * É o formato da primeira tela do funil de referência, e ele existe por um
 * motivo: a pergunta de abertura precisa ser respondida sem leitura. Três
 * cartões grandes com desenho no meio se resolvem num olhar; três linhas de
 * texto exigem que a pessoa leia antes de tocar, e é na abertura que ela
 * ainda não decidiu ficar.
 */
/** Escolha com marca persistente, para escolher mais de uma. */
export function EscolhaMultipla({
  opcoes,
  selecionados,
  max,
  onAlternar,
}: {
  opcoes: { valor: string; rotulo: string }[];
  selecionados: string[];
  max: number;
  onAlternar: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {opcoes.map((o) => {
        const ativo = selecionados.includes(o.valor);
        const cheio = selecionados.length >= max && !ativo;
        return (
          <button
            key={o.valor}
            onClick={() => !cheio && onAlternar(o.valor)}
            disabled={cheio}
            aria-pressed={ativo}
            className={[
              'flex items-center gap-3.5 text-left font-corpo rounded-2xl px-5 py-4 border transition-all duration-200 text-[1.02rem]',
              ativo
                ? 'border-ouro-velho bg-ouro-velho/12 text-escrita'
                : cheio
                  ? 'border-escrita/10 text-escrita-corpo/35'
                  : 'border-escrita/18 text-escrita-corpo hover:border-ouro-velho/55 hover:bg-ouro-velho/5',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className={[
                'flex items-center justify-center size-5 rounded-md border shrink-0 transition',
                ativo ? 'border-ouro-velho bg-ouro-velho text-tinta' : 'border-escrita/30',
              ].join(' ')}
            >
              {ativo && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5 9.5 18 20 6.5" />
                </svg>
              )}
            </span>
            <span>{o.rotulo}</span>
          </button>
        );
      })}
      <p className="font-corpo text-[0.78rem] text-escrita-fraca text-center mt-1">
        {selecionados.length} de {max}
      </p>
    </div>
  );
}

/** Escolha de cor: a amostra É a opção. */
export function EscolhaDeCor({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { valor: string; rotulo: string; hex: string }[];
  valor?: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            onClick={() => onEscolher(o.valor)}
            aria-pressed={ativo}
            className={[
              'flex flex-col items-center gap-2.5 rounded-2xl px-2 py-4 border transition-all duration-200',
              ativo ? 'border-ouro-velho bg-ouro-velho/12' : 'border-escrita/18 hover:border-ouro-velho/55',
            ].join(' ')}
          >
            <span
              className="size-11 rounded-full transition-all duration-200"
              style={{
                backgroundColor: o.hex,
                boxShadow: ativo
                  ? `0 0 22px color-mix(in srgb, ${o.hex} 70%, transparent)`
                  : 'inset 0 0 0 1px rgba(0,0,0,0.18)',
              }}
            />
            <span className={`font-corpo text-[0.8rem] leading-tight text-center ${ativo ? 'text-escrita' : 'text-escrita-corpo'}`}>
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Quatro cartões em grade 2×2 — os elementos. */
export function CartoesQuatro({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { valor: string; rotulo: string; desenho: NomeDoIcone }[];
  valor?: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            onClick={() => onEscolher(o.valor)}
            aria-pressed={ativo}
            className={[
              'flex flex-col items-center gap-3 rounded-2xl px-3 py-6 border transition-all duration-200',
              ativo ? 'border-ouro-velho bg-ouro-velho/12' : 'border-escrita/18 hover:border-ouro-velho/55 hover:bg-ouro-velho/5',
            ].join(' ')}
          >
            <span
              className={[
                'flex items-center justify-center size-14 rounded-full transition-all duration-200',
                ativo ? 'text-tinta' : 'text-ouro-velho',
              ].join(' ')}
              style={{
                background: ativo ? 'var(--ouro-velho)' : 'color-mix(in srgb, var(--ouro-velho) 12%, transparent)',
                boxShadow: ativo ? '0 0 22px color-mix(in srgb, var(--ouro-velho) 45%, transparent)' : undefined,
              }}
            >
              <Icone nome={o.desenho} tamanho={26} espessura={1.6} />
            </span>
            <span className={`font-corpo text-[0.95rem] ${ativo ? 'text-escrita' : 'text-escrita-corpo'}`}>
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CartoesDeEscolha({
  opcoes,
  valor,
  onEscolher,
}: {
  opcoes: { valor: string; rotulo: string; icone: NomeDoIcone }[];
  valor?: string;
  onEscolher: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      {opcoes.map((o) => {
        const ativo = valor === o.valor;
        return (
          <button
            key={o.valor}
            onClick={() => onEscolher(o.valor)}
            aria-pressed={ativo}
            className={[
              'flex flex-col items-center gap-3 rounded-2xl px-2 py-5 border transition-all duration-200',
              ativo
                ? 'border-ouro-velho bg-ouro-velho/12'
                : 'border-escrita/18 hover:border-ouro-velho/55 hover:bg-ouro-velho/5',
            ].join(' ')}
          >
            <span
              className={[
                'flex items-center justify-center size-14 rounded-full transition-all duration-200',
                ativo ? 'text-tinta' : 'text-ouro-velho',
              ].join(' ')}
              style={{
                background: ativo
                  ? 'var(--ouro-velho)'
                  : 'color-mix(in srgb, var(--ouro-velho) 12%, transparent)',
                boxShadow: ativo
                  ? '0 0 22px color-mix(in srgb, var(--ouro-velho) 45%, transparent)'
                  : undefined,
              }}
            >
              <Icone nome={o.icone} tamanho={28} espessura={1.6} />
            </span>
            <span
              className={[
                'font-corpo text-[0.9rem] leading-tight text-center',
                ativo ? 'text-escrita' : 'text-escrita-corpo',
              ].join(' ')}
            >
              {o.rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
}
