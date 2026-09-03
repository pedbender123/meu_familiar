'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, List, X, Volume2, VolumeX } from 'lucide-react';
import type { LivroLido } from '@/nucleo/biblioteca/formato';

/**
 * O modo de leitura.
 *
 * ── Por que não é um PDF ──────────────────────────────────────────────────
 *
 * Três coisas que só existem aqui, e são a razão de o livro ter virado texto:
 * a pessoa **continua de onde parou**, o capítulo tem **trilha de fundo**, e a
 * leitura acontece dentro do mundo do produto — pergaminho, vela, a mesma
 * tipografia da revelação — em vez de um visualizador cinza do navegador.
 *
 * ── As fitinhas ───────────────────────────────────────────────────────────
 *
 * O sumário é uma coluna de marcadores coloridos na lateral, um por módulo,
 * como as fitas que se deixam num livro grosso. Elas resolvem o problema real
 * de ler num telefone: saber ONDE você está sem sair da página.
 *
 * A cor não é decoração — é a única forma de reconhecer um módulo de relance,
 * antes de ler o título. Por isso são poucas e fixas.
 *
 * ── Onde a pessoa parou mora no navegador ─────────────────────────────────
 *
 * `localStorage`, não banco. A alternativa seria uma escrita no servidor a
 * cada troca de capítulo — muito custo para um dado que só interessa a esta
 * pessoa neste aparelho, e que perder não dói: o pior caso é ela reabrir no
 * capítulo um e tocar duas vezes.
 */

/** As fitas. Poucas e fixas: cor demais deixa de identificar coisa nenhuma. */
const CORES_DOS_MODULOS = ['#D9A441', '#8E7CC3', '#6FA287', '#C97B6B', '#7FA1C4'];

function corDoModulo(i: number) {
  return CORES_DOS_MODULOS[i % CORES_DOS_MODULOS.length];
}

export function Leitor({
  ebookId,
  titulo,
  livro,
}: {
  ebookId: string;
  titulo: string;
  livro: LivroLido;
}) {
  const plano = useMemo(
    () =>
      livro.modulos.flatMap((m, mi) =>
        m.capitulos.map((c, ci) => ({
          modulo: m,
          moduloIndice: mi,
          capitulo: c,
          capituloIndice: ci,
        }))
      ),
    [livro]
  );

  const [posicao, setPosicao] = useState(0);
  const [sumarioAberto, setSumarioAberto] = useState(false);
  const [somLigado, setSomLigado] = useState(false);

  const chave = `bx_leitura_${ebookId}`;

  /*
    A retomada roda depois da primeira pintura, não durante.

    Ler `localStorage` no corpo do componente faria servidor e navegador
    renderizarem capítulos diferentes — o React reclama e o texto pisca. Aqui
    a página abre no capítulo um e salta para o guardado um quadro depois.
  */
  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(chave));
      if (Number.isFinite(salvo) && salvo > 0 && salvo < plano.length) setPosicao(salvo);
    } catch {
      // Armazenamento bloqueado: começa do início, e tudo bem.
    }
  }, [chave, plano.length]);

  useEffect(() => {
    try {
      localStorage.setItem(chave, String(posicao));
    } catch {
      /* idem */
    }
  }, [chave, posicao]);

  // Trocar de capítulo volta ao topo: continuar na altura anterior joga a
  // pessoa no meio de um texto que ela não começou.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [posicao]);

  const atual = plano[posicao];
  if (!atual) return null;

  const cor = corDoModulo(atual.moduloIndice);
  const progresso = ((posicao + 1) / plano.length) * 100;

  function irPara(i: number) {
    setPosicao(Math.max(0, Math.min(plano.length - 1, i)));
    setSumarioAberto(false);
  }

  const borda = 'color-mix(in srgb, var(--pergaminho) 16%, transparent)';

  return (
    <div className="w-full max-w-3xl flex flex-col gap-6 py-6">
      <header className="flex items-center gap-3">
        <Link
          href="/conta/biblioteca"
          aria-label="Voltar para a biblioteca"
          className="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-pergaminho/60 hover:text-vela transition"
          style={{ borderColor: borda }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </Link>

        <div className="flex-1 min-w-0">
          <p className="font-corpo text-[0.68rem] tracking-[0.14em] uppercase text-pergaminho/35 truncate">
            {titulo}
          </p>
          <p className="font-corpo text-[0.72rem] text-pergaminho/50 truncate">
            {atual.modulo.titulo}
          </p>
        </div>

        {/*
          O botão de som fica desabilitado, e não escondido, quando o capítulo
          não tem trilha: sumir e voltar a cada capítulo faria o cabeçalho
          dançar, e o `title` explica por que ele está apagado.
        */}
        <button
          onClick={() => setSomLigado((v) => !v)}
          disabled={!atual.capitulo.som}
          aria-label={somLigado ? 'Desligar a trilha' : 'Ligar a trilha'}
          title={
            atual.capitulo.som
              ? `Trilha: ${atual.capitulo.som}`
              : 'Este capítulo é lido em silêncio'
          }
          className="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition disabled:opacity-25"
          style={{
            borderColor: somLigado ? 'rgba(217,164,65,0.5)' : borda,
            color: somLigado ? 'var(--vela)' : 'color-mix(in srgb, var(--pergaminho) 55%, transparent)',
          }}
        >
          {somLigado ? <Volume2 size={15} strokeWidth={1.5} /> : <VolumeX size={15} strokeWidth={1.5} />}
        </button>

        <button
          onClick={() => setSumarioAberto((v) => !v)}
          aria-label="Sumário"
          className="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-pergaminho/60 hover:text-vela transition"
          style={{ borderColor: borda }}
        >
          <List size={16} strokeWidth={1.5} />
        </button>
      </header>

      <div
        className="h-[2px] w-full rounded-full overflow-hidden"
        style={{ background: 'color-mix(in srgb, var(--pergaminho) 10%, transparent)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progresso}%`, background: cor }}
        />
      </div>

      <div className="flex gap-4">
        {/*
          As fitinhas ficam sempre à vista no desktop, coladas na lateral do
          texto. No celular somem — 320px não têm espaço para uma coluna
          lateral, e lá o mesmo sumário abre pelo botão do cabeçalho.
        */}
        <nav
          aria-label="Módulos"
          className="hidden lg:flex flex-col gap-2 pt-2 shrink-0 sticky top-6 self-start"
        >
          {livro.modulos.map((m, i) => {
            const ativo = i === atual.moduloIndice;
            const primeiro = plano.findIndex((p) => p.moduloIndice === i);
            return (
              <button key={m.titulo} onClick={() => irPara(primeiro)} title={m.titulo}
                aria-current={ativo ? 'true' : undefined}
                className="group relative flex items-center">
                <span
                  className="block rounded-r-sm transition-all duration-300"
                  style={{
                    width: ativo ? 22 : 12,
                    height: 4,
                    background: corDoModulo(i),
                    opacity: ativo ? 1 : 0.4,
                  }}
                />
                <span
                  className="absolute left-7 whitespace-nowrap font-corpo text-[0.7rem] text-pergaminho/70 opacity-0 group-hover:opacity-100 transition pointer-events-none px-2 py-1 rounded-md"
                  style={{ background: 'rgba(20,16,26,0.92)' }}
                >
                  {m.titulo}
                </span>
              </button>
            );
          })}
        </nav>

        <article className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span
              className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase"
              style={{ color: cor }}
            >
              Capítulo {posicao + 1} de {plano.length} · {atual.capitulo.minutos} min
            </span>
            <h1 className="font-display italic text-2xl sm:text-[1.75rem] leading-snug text-pergaminho">
              {atual.capitulo.titulo}
            </h1>
          </div>

          {atual.capitulo.blocos.map((bloco, i) =>
            bloco.tipo === 'pratica' ? (
              /*
                A prática é visualmente OUTRA COISA: filete na cor do módulo,
                recuo e rótulo. Ela pede que a pessoa pare de ler e faça — e um
                bloco que pede ação precisa parecer diferente do que informa,
                senão os olhos passam por cima.
              */
              <aside
                key={i}
                className="flex flex-col gap-3 rounded-xl border-l-2 pl-5 pr-4 py-4"
                style={{
                  borderColor: cor,
                  background: 'color-mix(in srgb, var(--pergaminho) 4%, transparent)',
                }}
              >
                <span
                  className="font-corpo text-[0.6rem] tracking-[0.18em] uppercase"
                  style={{ color: cor }}
                >
                  Prática
                </span>
                {bloco.paragrafos.map((p, j) => (
                  <p key={j} className="font-corpo font-light text-[0.95rem] leading-[1.75] text-pergaminho/85">
                    {p}
                  </p>
                ))}
              </aside>
            ) : (
              <div key={i} className="flex flex-col gap-4">
                {bloco.paragrafos.map((p, j) => (
                  <p key={j} className="font-corpo font-light text-[1rem] leading-[1.85] text-pergaminho/80">
                    {p}
                  </p>
                ))}
              </div>
            )
          )}

          <div
            className="flex items-center justify-between gap-3 pt-6 mt-2 border-t"
            style={{ borderColor: 'color-mix(in srgb, var(--pergaminho) 10%, transparent)' }}
          >
            <button
              onClick={() => irPara(posicao - 1)}
              disabled={posicao === 0}
              className="inline-flex items-center gap-1.5 font-corpo text-[0.8rem] text-pergaminho/55 hover:text-vela transition disabled:opacity-25"
            >
              <ChevronLeft size={15} strokeWidth={1.5} /> Anterior
            </button>

            {posicao === plano.length - 1 ? (
              <Link
                href="/conta/biblioteca"
                className="inline-flex items-center gap-1.5 font-corpo text-[0.8rem] text-vela hover:brightness-110 transition"
              >
                Terminei este livro
              </Link>
            ) : (
              <button
                onClick={() => irPara(posicao + 1)}
                className="inline-flex items-center gap-1.5 font-corpo text-[0.8rem] text-vela hover:brightness-110 transition"
              >
                Próximo <ChevronRight size={15} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </article>
      </div>

      {sumarioAberto && (
        <>
          <div
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(12,10,16,0.75)' }}
            onClick={() => setSumarioAberto(false)}
          />
          <div
            className="fixed z-40 inset-x-4 top-16 bottom-16 sm:inset-x-auto sm:right-8 sm:w-[380px] rounded-2xl border overflow-y-auto p-5 flex flex-col gap-5"
            style={{ borderColor: borda, background: 'var(--tinta, #14101A)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-corpo text-[0.68rem] tracking-[0.16em] uppercase text-pergaminho/45">
                Sumário
              </h2>
              <button
                onClick={() => setSumarioAberto(false)}
                aria-label="Fechar"
                className="text-pergaminho/50 hover:text-vela transition"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {livro.modulos.map((m, mi) => (
              <div key={m.titulo} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="block w-4 h-[3px] rounded-full shrink-0"
                    style={{ background: corDoModulo(mi) }}
                  />
                  <span className="font-corpo text-[0.78rem] text-pergaminho/70">{m.titulo}</span>
                </div>
                <ul className="flex flex-col gap-0.5 pl-6">
                  {m.capitulos.map((c, ci) => {
                    const indice = plano.findIndex(
                      (p) => p.moduloIndice === mi && p.capituloIndice === ci
                    );
                    return (
                      <li key={c.titulo}>
                        <button
                          onClick={() => irPara(indice)}
                          className="w-full text-left font-corpo font-light text-[0.8rem] leading-snug py-1.5 transition"
                          style={{
                            color:
                              indice === posicao
                                ? 'var(--vela)'
                                : 'color-mix(in srgb, var(--pergaminho) 55%, transparent)',
                          }}
                        >
                          {c.titulo}
                          <span className="text-pergaminho/25"> · {c.minutos} min</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
