'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import {
  paginarCapitulo,
  partesDoParagrafo,
  type LivroLido,
} from '@/nucleo/biblioteca/formato';
import {
  alternarTrilha,
  assinarTrilha,
  estadoDaTrilha,
  estadoDaTrilhaNoServidor,
  pedirTrilha,
} from '@/lib/trilha';

/**
 * O modo de leitura — um livro apoiado na mesa, não uma página de site.
 *
 * ── A regra que a primeira versão violou ──────────────────────────────────
 *
 * A estética do Bruxário tem uma regra de composição: **o que é grimório vai
 * DENTRO da folha; o que é interface fica FORA, no quarto.** A primeira
 * versão deste leitor pôs o texto direto sobre o fundo escuro, com títulos e
 * botões misturados — e o resultado foi exatamente o que se esperaria: leu
 * como post de blog. Texto claro sobre roxo é ruim de ler e não é livro
 * nenhum.
 *
 * Agora o capítulo mora no pergaminho, com a mesma tinta e a mesma tipografia
 * da revelação. Navegação, som e fitas ficam do lado de fora.
 *
 * ── As fitas ──────────────────────────────────────────────────────────────
 *
 * Vivem na faixa entre a borda esquerda da tela e a borda do papel — o espaço
 * que num livro grosso é onde as fitas realmente ficam. Em repouso são só
 * cor: nenhum texto, nenhuma caixa. Tocou, elas **se jogam por cima do
 * papel**, cada uma com o nome do módulo, e os capítulos daquele módulo
 * descem embaixo.
 *
 * Aparecer o tempo todo com nome as transformaria em menu lateral, que é
 * interface — e interface sobre pergaminho lê como anacronismo.
 */

/** As cores das fitas. Poucas e fixas: cor demais deixa de identificar nada. */
const CORES = ['#9C3B2E', '#2F5D50', '#4A3B7A', '#8A6B1F', '#3B5470'];

function corDoModulo(i: number) {
  return CORES[i % CORES.length];
}

export function Leitor({
  ebookId,
  titulo,
  livro,
  download,
}: {
  ebookId: string;
  titulo: string;
  livro: LivroLido;
  /**
   * O estado do arquivo para levar embora. Só existe para quem COMPROU o
   * livro — assinante lê e não baixa. Ver `downloadDoLivro`.
   */
  download?: { liberado: boolean; diasQueFaltam: number; comprado: boolean };
}) {
  /**
   * A linha reta da leitura: uma entrada por PÁGINA, não por capítulo.
   *
   * ── Por que o capítulo virou várias folhas ──────────────────────────────
   *
   * Um capítulo de mil palavras numa folha só transforma o pergaminho em rolo,
   * e o efeito de estar lendo um livro — que é a razão do desenho inteiro —
   * desaparece na terceira tela de rolagem.
   *
   * Paginando, "próximo" vira virar a página, e a última página do capítulo
   * cai naturalmente no capítulo seguinte. A pessoa nunca precisa saber que
   * existe uma fronteira entre as duas coisas.
   */
  const plano = useMemo(
    () =>
      livro.modulos.flatMap((m, mi) =>
        m.capitulos.flatMap((c, ci) =>
          paginarCapitulo(c).map((pagina, pi, todas) => ({
            modulo: m,
            moduloIndice: mi,
            capitulo: c,
            capituloIndice: ci,
            pagina,
            paginaIndice: pi,
            paginasDoCapitulo: todas.length,
          }))
        )
      ),
    [livro]
  );

  const [posicao, setPosicao] = useState(0);
  const [fitasAbertas, setFitasAbertas] = useState(false);

  /**
   * O som do capítulo é o tocador da plataforma, não um player daqui.
   *
   * O `som:` do Markdown nomeia uma faixa do catálogo (`nucleo/trilhas`), e o
   * tocador que fica no canto da tela é quem toca — o mesmo que continua
   * tocando quando a pessoa sai do livro. Um segundo elemento de áudio aqui
   * dentro daria duas músicas ao mesmo tempo e dois botões que se ignoram.
   */
  const trilha = useSyncExternalStore(
    assinarTrilha,
    estadoDaTrilha,
    estadoDaTrilhaNoServidor
  );

  const chave = `bx_leitura_${ebookId}`;

  /*
    A retomada roda depois da primeira pintura. Ler `localStorage` durante a
    renderização faria servidor e navegador desenharem capítulos diferentes —
    o React reclama e o texto pisca.
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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [posicao]);

  /**
   * O capítulo PEDE a trilha dele; quem decide é a pessoa.
   *
   * `pedirTrilha` só troca a faixa se o tocador já estiver tocando — virar a
   * página não pode religar um som que ela desligou. Ver `lib/trilha.ts`.
   */
  useEffect(() => {
    pedirTrilha(plano[posicao]?.capitulo.som);
  }, [plano, posicao]);

  // Fechar com Esc: a fita aberta cobre o texto, e cobrir texto sem saída pelo
  // teclado é o tipo de coisa que prende quem lê no computador.
  useEffect(() => {
    if (!fitasAbertas) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setFitasAbertas(false);
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [fitasAbertas]);

  const atual = plano[posicao];
  if (!atual) return null;

  const cor = corDoModulo(atual.moduloIndice);
  const tocandoEsteCapitulo = trilha.tocando && trilha.id === atual.capitulo.som;

  function irPara(i: number) {
    setPosicao(Math.max(0, Math.min(plano.length - 1, i)));
    setFitasAbertas(false);
  }

  return (
    <div className="relative w-full flex flex-col items-center gap-6 py-6">
      {/* ── o quarto: navegação, fora da folha ── */}
      <header className="w-full max-w-2xl flex items-center gap-3 px-1">
        <Link
          href="/conta/biblioteca"
          aria-label="Voltar para a biblioteca"
          className="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center text-pergaminho/55 hover:text-vela transition"
          style={{ borderColor: 'color-mix(in srgb, var(--pergaminho) 15%, transparent)' }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </Link>

        <div className="flex-1 min-w-0">
          <p className="font-corpo text-[0.66rem] tracking-[0.16em] uppercase text-pergaminho/30 truncate">
            {titulo}
          </p>
          <p className="font-corpo text-[0.72rem] text-pergaminho/45 truncate">
            {atual.modulo.titulo}
          </p>
        </div>

        {/*
          O botão liga a trilha DESTE capítulo no tocador da plataforma. Ele
          fica aceso enquanto a faixa pedida for a que está tocando — se a
          pessoa trocar de faixa no tocador, ele apaga, porque aí o som já não
          é o do capítulo.
        */}
        <button
          onClick={() => atual.capitulo.som && alternarTrilha(atual.capitulo.som)}
          disabled={!atual.capitulo.som}
          aria-label={tocandoEsteCapitulo ? 'Desligar a trilha' : 'Ligar a trilha'}
          title={
            atual.capitulo.som
              ? `Trilha: ${atual.capitulo.som}`
              : 'Este capítulo é lido em silêncio'
          }
          className="shrink-0 w-9 h-9 rounded-full border flex items-center justify-center transition disabled:opacity-20"
          style={{
            borderColor: tocandoEsteCapitulo
              ? 'rgba(217,164,65,0.5)'
              : 'color-mix(in srgb, var(--pergaminho) 15%, transparent)',
            color: tocandoEsteCapitulo
              ? 'var(--vela)'
              : 'color-mix(in srgb, var(--pergaminho) 50%, transparent)',
          }}
        >
          {tocandoEsteCapitulo ? <Volume2 size={15} strokeWidth={1.5} /> : <VolumeX size={15} strokeWidth={1.5} />}
        </button>
      </header>

      {/* ── a folha, com as fitas na margem ── */}
      <div className="relative w-full max-w-2xl">
        {/*
          As fitas em repouso: uma coluna de cor colada na borda esquerda,
          entre o fim da tela e o começo do papel. Sem texto, sem caixa.

          O deslocamento negativo as põe FORA do papel — é a margem do quarto,
          não da folha. Em telas estreitas elas encostam na borda da tela, que
          é exatamente onde uma fita fica num livro na mão.
        */}
        <nav
          aria-label="Módulos"
          /*
            ── Elas acompanham a rolagem ─────────────────────────────────────

            Antes eram `absolute` no topo do papel: sumiam na primeira rolagem
            e reapareciam no fim, e essa ausência é o tipo de coisa que a
            pessoa sente antes de saber o que é — ela percebe que tem algo
            estranho ali sem conseguir nomear.

            Fita de livro não fica numa altura do papel; fica na lateral, na
            sua mão, o tempo todo. `fixed` ancorado à esquerda da tela é o
            equivalente disso — a fita continua ali enquanto a folha corre por
            baixo.
          */
          className="fixed z-20 left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2.5"
        >
          {livro.modulos.map((m, i) => {
            const ativo = i === atual.moduloIndice;
            return (
              <button
                key={m.titulo}
                onClick={() => setFitasAbertas((v) => !v)}
                aria-label={`Módulos — ${m.titulo}`}
                aria-expanded={fitasAbertas}
                className="fita-do-modulo group relative block rounded-r-[3px] transition-all duration-300 hover:!w-[54px]"
                style={{
                  /*
                    Maiores do que eram: 7px de altura por 18 de largura era
                    quase invisível — a pessoa não achava o que clicar. Agora a
                    fita tem espessura de fita, e a ativa avança mais para
                    fora, como a que ficou marcando a página onde se parou.
                  */
                  width: ativo ? 44 : 30,
                  height: 13,
                  background: corDoModulo(i),
                  opacity: ativo ? 1 : 0.62,
                  boxShadow: ativo
                    ? `0 2px 10px ${corDoModulo(i)}88, inset -1px 0 0 rgba(255,255,255,0.18)`
                    : 'inset -1px 0 0 rgba(255,255,255,0.10)',
                }}
              >
                {/*
                  O corte em V na ponta, que é o que faz uma tira de tecido
                  parecer fita e não retângulo. Não serve para nada.
                */}
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 h-full w-[7px]"
                  style={{
                    background: 'var(--tinta)',
                    clipPath: 'polygon(100% 0, 0 50%, 100% 100%)',
                  }}
                />
              </button>
            );
          })}
        </nav>

        {/* ── as fitas jogadas por cima do papel ── */}
        {fitasAbertas && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setFitasAbertas(false)}
              style={{ background: 'rgba(12,10,16,0.35)' }}
            />
            {/*
              ── O painel nasce ONDE a fita está ──────────────────────────

              Ele era `absolute` no topo do papel: quem estava lendo a folha
              três clicava na fita e não via nada acontecer — o painel tinha
              aberto centenas de pixels acima, fora da tela. A pessoa
              concluía que o clique não funcionou.

              `fixed`, ancorado à esquerda e centrado na vertical, ele abre
              colado nas fitas, que é de onde ele saiu. `max-h` com rolagem
              própria porque um livro de cinco módulos com seis capítulos cada
              não cabe em tela de celular — e o painel rolando por dentro é
              melhor que o painel empurrando a página.
            */}
            <div
              className="fixed z-40 left-3 sm:left-5 top-1/2 -translate-y-1/2 w-[min(78vw,330px)] max-h-[80vh] overflow-y-auto flex flex-col gap-2 pr-1"
            >
              {livro.modulos.map((m, mi) => (
                <div
                  key={m.titulo}
                  className="rounded-r-md rounded-l-[2px] overflow-hidden"
                  style={{
                    // Cada fita cai com um atraso: elas se jogam sobre o papel
                    // uma depois da outra, como quem abre um livro pelas fitas.
                    animation: `fitaCai 380ms cubic-bezier(.2,.9,.3,1) ${mi * 55}ms both`,
                    boxShadow: '0 8px 20px -8px rgba(0,0,0,0.7)',
                  }}
                >
                  <div
                    className="px-3.5 py-2 flex items-center gap-2.5"
                    style={{ background: corDoModulo(mi) }}
                  >
                    <span className="font-corpo text-[0.74rem] text-[#F3EADA] leading-snug">
                      {m.titulo}
                    </span>
                  </div>
                  <ul
                    className="flex flex-col"
                    style={{ background: 'rgba(24,19,32,0.96)' }}
                  >
                    {m.capitulos.map((c, ci) => {
                      // A primeira folha do capítulo: é para onde o sumário
                      // leva, nunca para o meio dele.
                      const indice = plano.findIndex(
                        (p) =>
                          p.moduloIndice === mi &&
                          p.capituloIndice === ci &&
                          p.paginaIndice === 0
                      );
                      const aqui =
                        atual.moduloIndice === mi && atual.capituloIndice === ci;
                      return (
                        <li key={c.titulo}>
                          <button
                            onClick={() => irPara(indice)}
                            className="w-full text-left px-3.5 py-2 font-corpo font-light text-[0.78rem] leading-snug transition hover:bg-white/5"
                            style={{
                              color: aqui
                                ? 'var(--vela)'
                                : 'color-mix(in srgb, var(--pergaminho) 60%, transparent)',
                            }}
                          >
                            {c.titulo}
                            <span className="opacity-40"> · {c.minutos} min</span>
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

        <FolhaPergaminho>
          {/*
            Tudo daqui para baixo é grimório: mesma tinta, mesma tipografia da
            revelação. Nenhum botão vive aqui dentro.
          */}
          {/*
            O título abre o capítulo e não se repete nas folhas seguintes —
            como num livro impresso, onde ele aparece na página de abertura e
            some. Repetir a cada folha diria "cada página é um começo", que é
            o contrário do que uma leitura contínua deve sentir.
          */}
          {atual.paginaIndice === 0 ? (
            <>
              <span
                className="font-corpo text-[0.6rem] tracking-[0.22em] uppercase"
                style={{ color: cor }}
              >
                {atual.modulo.titulo}
              </span>

              <h1 className="font-display italic text-[1.6rem] sm:text-[2rem] leading-tight text-center text-escrita text-balance max-w-[24ch]">
                {atual.capitulo.titulo}
              </h1>

              {/* O filete que separa o título do corpo, como num livro impresso. */}
              <span
                aria-hidden="true"
                className="block h-px w-16"
                style={{ background: `linear-gradient(90deg, transparent, ${cor}88, transparent)` }}
              />
            </>
          ) : (
            /*
              Nas folhas seguintes, só a cabeça de página: o título do capítulo
              pequeno e apagado, do jeito que livro impresso faz. É o que diz
              "você ainda está no mesmo capítulo" sem ocupar a folha.
            */
            <span className="font-corpo text-[0.62rem] tracking-[0.14em] uppercase text-escrita-fraca/50 self-center">
              {atual.capitulo.titulo}
            </span>
          )}

          <div className="w-full flex flex-col gap-5 max-w-[46ch]">
            {atual.pagina.blocos.map((bloco, i) =>
              bloco.tipo === 'pratica' ? (
                /*
                  A prática é a margem do livro: recuo, filete na cor do
                  módulo e itálico. Ela pede que a pessoa PARE de ler e faça —
                  e um bloco que pede ação precisa parecer diferente do que
                  informa, senão os olhos passam por cima.
                */
                <aside
                  key={i}
                  className="relative flex flex-col gap-3 pl-5 py-1 my-1"
                  style={{ borderLeft: `2px solid ${cor}` }}
                >
                  <span
                    className="font-corpo text-[0.58rem] tracking-[0.22em] uppercase"
                    style={{ color: cor }}
                  >
                    Prática
                  </span>
                  {bloco.paragrafos.map((p, j) => (
                    <p
                      key={j}
                      className="font-corpo font-light text-[0.95rem] leading-[1.8] text-escrita-corpo italic"
                    >
                      <ComEnfase texto={p} />
                    </p>
                  ))}
                </aside>
              ) : (
                <div key={i} className="flex flex-col gap-4">
                  {bloco.paragrafos.map((p, j) => (
                    <p
                      key={j}
                      className="font-corpo font-light text-[1.02rem] leading-[1.85] text-escrita-corpo"
                    >
                      <ComEnfase texto={p} />
                    </p>
                  ))}
                </div>
              )
            )}
          </div>

          {/*
            O número da página, no rodapé da folha. Não serve para nada — dá
            para navegar sem ele. É o detalhe que faz a coisa parecer um livro
            em vez de uma tela com texto.
          */}
          <span className="font-corpo text-[0.68rem] tabular-nums text-escrita-fraca/60 mt-3">
            {atual.paginasDoCapitulo > 1
              ? `${atual.paginaIndice + 1} de ${atual.paginasDoCapitulo} · ${posicao + 1}/${plano.length}`
              : `${posicao + 1} / ${plano.length}`}
          </span>
        </FolhaPergaminho>
      </div>

      {/* ── de volta ao quarto: avançar e voltar ── */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-3 px-1">
        <button
          onClick={() => irPara(posicao - 1)}
          disabled={posicao === 0}
          className="inline-flex items-center gap-1.5 font-corpo text-[0.8rem] text-pergaminho/50 hover:text-vela transition disabled:opacity-20"
        >
          <ChevronLeft size={15} strokeWidth={1.5} /> Anterior
        </button>

        <span className="font-corpo text-[0.7rem] text-pergaminho/25 tabular-nums">
          {atual.pagina.minutos} min
        </span>

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

      <Exemplar ebookId={ebookId} download={download} />
    </div>
  );
}

/**
 * O negrito do Markdown, desenhado como negrito.
 *
 * Os livros usam `**assim**` dezenas de vezes, e sem isto o leitor mostrava os
 * asteriscos crus no meio da frase — o defeito mais barato de perceber que um
 * produto pode ter. Ver `partesDoParagrafo`.
 *
 * `font-medium`, e não `font-bold`: a folha é Sora Light num corpo pequeno, e
 * o negrito cheio sobre pergaminho vira borrão. O que se quer é a frase pesar
 * um pouco mais, não gritar.
 */
function ComEnfase({ texto }: { texto: string }) {
  return (
    <>
      {partesDoParagrafo(texto).map((parte, i) =>
        parte.forte ? (
          <strong key={i} className="font-medium text-escrita">
            {parte.texto}
          </strong>
        ) : (
          <span key={i}>{parte.texto}</span>
        )
      )}
    </>
  );
}

/**
 * O exemplar em PDF — o que a pessoa leva embora.
 *
 * ── Só quem comprou, e só depois de sete dias ─────────────────────────────
 *
 * Quem lê pela assinatura não vê nada aqui: não há arquivo, e não é
 * esquecimento — é o que a assinatura vende (acesso enquanto durar) contra o
 * que a compra dá (o livro, para sempre). Ver `nucleo/carencia.ts` para o
 * prazo, e `downloadDoLivro` para quem tem direito.
 *
 * ── Por que a espera é anunciada ──────────────────────────────────────────
 *
 * Um botão que aparece do nada uma semana depois não é notado por ninguém.
 * Contar os dias promete uma coisa que vai chegar, e dá motivo para voltar.
 */
function Exemplar({
  ebookId,
  download,
}: {
  ebookId: string;
  download?: { liberado: boolean; diasQueFaltam: number; comprado: boolean };
}) {
  if (!download?.comprado) return null;

  if (!download.liberado) {
    return (
      <p className="font-corpo text-[0.7rem] text-pergaminho/30 text-center max-w-[34ch] leading-relaxed">
        O seu exemplar em PDF, com o seu nome na capa, fica pronto para guardar{' '}
        {download.diasQueFaltam === 1 ? 'amanhã' : `em ${download.diasQueFaltam} dias`}.
      </p>
    );
  }

  return (
    <a
      href={`/api/biblioteca/${ebookId}/pdf`}
      className="font-corpo text-[0.78rem] px-5 py-2 rounded-full border border-pergaminho/15 text-pergaminho/45 hover:border-pergaminho/40 hover:text-pergaminho/80 transition-colors"
    >
      Guardar o exemplar em PDF
    </a>
  );
}
