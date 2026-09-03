'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  alternarTrilha,
  assinarTrilha,
  definirVolumeDaTrilha,
  estadoDaTrilha,
  estadoDaTrilhaNoServidor,
  fecharRadio,
  passarTrilha,
  pausarTrilha,
  tocarTrilha,
} from '@/lib/trilha';
import { ehModoLeitura } from './modo-leitura';
import type { Trilha } from '@/nucleo/trilhas/catalogo';

/**
 * O rádio — um aparelho pequeno que a pessoa chama quando quer.
 *
 * ── O que ele deixou de ser ───────────────────────────────────────────────
 *
 * A primeira versão era uma pastilha fixa no canto da tela, sempre visível.
 * No celular ela caía exatamente em cima da barra de navegação e tapava dois
 * botões — o controle de uma coisa opcional ocupando o lugar de como se anda
 * pelo produto.
 *
 * Agora ele nasce escondido, em toda visita, e só aparece quando alguém pede
 * (pelo botão de som no menu, ou pelo do leitor). Fechado ele não existe na
 * tela; aberto, é uma faixa fina que se pode fechar de novo num toque.
 *
 * ── Por que rádio, e não lista de músicas ─────────────────────────────────
 *
 * Porque cabe. Voltar, pausar, avançar, o nome passando, e o volume atrás de
 * um clique: é o vocabulário que qualquer pessoa já sabe usar sem ler nada, e
 * ocupa uma tira de quarenta pixels. A lista continua existindo — ela abre ao
 * tocar no nome, que é onde a pessoa procuraria de qualquer forma.
 *
 * ── Onde ele se apoia ─────────────────────────────────────────────────────
 *
 * Acima da barra de baixo no celular, para nunca mais tapar a navegação; no
 * pé da tela quando o menu não existe (dentro do livro). No computador ele
 * mora no canto esquerdo, onde a barra lateral termina.
 */
export function Radio({
  trilhas,
  assinaturaAtiva,
}: {
  trilhas: Trilha[];
  assinaturaAtiva: boolean;
}) {
  const estado = useSyncExternalStore(
    assinarTrilha,
    estadoDaTrilha,
    estadoDaTrilhaNoServidor
  );
  const caminho = usePathname();
  const lendo = ehModoLeitura(caminho);
  const [listaAberta, setListaAberta] = useState(false);
  const [volumeAberto, setVolumeAberto] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  const liberadas = trilhas.filter((t) => t.gratuita || assinaturaAtiva);
  const ids = liberadas.map((t) => t.id);
  const atual =
    liberadas.find((t) => t.id === estado.id) ??
    trilhas.find((t) => t.id === estado.id && (t.gratuita || assinaturaAtiva)) ??
    liberadas[0] ??
    null;

  /**
   * O elemento de áudio segue o estado, e não o contrário.
   *
   * `play()` devolve uma promessa que o navegador rejeita quando ainda não
   * houve gesto — e a rejeição sem `catch` vira erro no console de todo
   * mundo. O botão continua ali; o segundo clique funciona.
   */
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = estado.volume;
    if (estado.tocando && atual) el.play().catch(() => {});
    else el.pause();
  }, [estado.tocando, estado.volume, estado.id, atual]);

  /**
   * Fecha os dois painéis quando o rádio some — reabrir com a lista de ontem
   * escancarada não é o que ninguém espera.
   *
   * Ajustado durante a renderização, e não num efeito: o React trata este
   * padrão como estado derivado e refaz o render antes de pintar, sem o
   * piscar de um efeito que corrige a tela depois de ela já ter aparecido.
   */
  const [estavaAberto, setEstavaAberto] = useState(estado.aberto);
  if (estavaAberto !== estado.aberto) {
    setEstavaAberto(estado.aberto);
    if (!estado.aberto) {
      setListaAberta(false);
      setVolumeAberto(false);
    }
  }

  if (trilhas.length === 0) return null;

  /**
   * O áudio fica montado mesmo com o rádio fechado.
   *
   * Fechar é esconder o aparelho, não desligá-lo — quem fechou com música
   * tocando quer continuar ouvindo. Desmontar o elemento cortaria o som no
   * meio, que é o oposto do que o gesto pede.
   */
  const som = atual && (
    <audio
      ref={audio}
      src={atual.arquivo}
      loop
      preload="none"
      onPlay={() => tocarTrilha(atual.id)}
      onPause={() => pausarTrilha()}
    />
  );

  if (!estado.aberto) return <>{som}</>;

  return (
    <>
      {som}

      <div
        className={[
          'fixed z-40 flex flex-col items-start gap-2 px-3 lg:px-0',
          'inset-x-0 lg:inset-x-auto lg:left-5 lg:w-auto',
          // Acima da barra de navegação no celular; no pé quando ela não
          // existe. `safe-area` mantém o rádio longe do gesto do iPhone.
          lendo ? 'bottom-4' : 'bottom-[calc(env(safe-area-inset-bottom)+4.6rem)] lg:bottom-5',
        ].join(' ')}
      >
        {listaAberta && (
          <ListaDeTrilhas
            trilhas={trilhas}
            assinaturaAtiva={assinaturaAtiva}
            tocandoId={estado.tocando ? estado.id : null}
            aoEscolher={(id) => {
              alternarTrilha(id);
              setListaAberta(false);
            }}
          />
        )}

        <div className="w-full lg:w-[19rem] flex items-center gap-0.5 rounded-full border border-pergaminho/15 bg-tinta/92 backdrop-blur-md shadow-lg shadow-black/30 px-1.5 py-1">
          <Botao
            aoTocar={() => passarTrilha(ids, -1)}
            rotulo="Faixa anterior"
            desligado={ids.length < 2}
          >
            <Anterior />
          </Botao>

          <Botao
            aoTocar={() => atual && alternarTrilha(atual.id)}
            rotulo={estado.tocando ? 'Pausar' : 'Tocar'}
            desligado={!atual}
            destaque
          >
            {estado.tocando ? <Pausa /> : <Play />}
          </Botao>

          <Botao
            aoTocar={() => passarTrilha(ids, 1)}
            rotulo="Próxima faixa"
            desligado={ids.length < 2}
          >
            <Proxima />
          </Botao>

          {/*
            O nome passando, e não cortado com reticências.

            Um rádio de quarenta pixels não tem largura para "Silêncio com
            vento" — e cortar em "Silênci…" é a metade que não diz nada. A
            faixa deslizando resolve sem ocupar espaço nenhum a mais, e de
            quebra é o detalhe que faz o aparelho parecer um aparelho.
          */}
          <button
            onClick={() => {
              setListaAberta((a) => !a);
              setVolumeAberto(false);
            }}
            aria-expanded={listaAberta}
            className="flex-1 min-w-0 h-8 px-2 rounded-full hover:bg-pergaminho/[0.06] transition-colors"
          >
            <NomeQuePassa texto={atual?.nome ?? 'sem trilha'} />
          </button>

          <div className="relative shrink-0">
            {volumeAberto && (
              <BarraDeVolume
                volume={estado.volume}
                aoMudar={(v) => definirVolumeDaTrilha(v)}
              />
            )}
            <Botao
              aoTocar={() => {
                setVolumeAberto((a) => !a);
                setListaAberta(false);
              }}
              rotulo="Volume"
            >
              <AltoFalante mudo={estado.volume === 0} />
            </Botao>
          </div>

          <Botao aoTocar={fecharRadio} rotulo="Esconder o rádio">
            <Fechar />
          </Botao>
        </div>
      </div>
    </>
  );
}

/* ── as peças ────────────────────────────────────────────────────────────── */

function Botao({
  children,
  aoTocar,
  rotulo,
  desligado = false,
  destaque = false,
}: {
  children: React.ReactNode;
  aoTocar: () => void;
  rotulo: string;
  desligado?: boolean;
  destaque?: boolean;
}) {
  return (
    <button
      onClick={aoTocar}
      disabled={desligado}
      aria-label={rotulo}
      title={rotulo}
      className={[
        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-25',
        destaque ? 'text-vela hover:bg-vela/10' : 'text-pergaminho/55 hover:text-pergaminho',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * O nome deslizando de um lado ao outro.
 *
 * A animação só existe quando o texto não cabe — texto curto parado é o
 * certo, e fazer "Chuva ao longe" correr sem necessidade seria movimento
 * gratuito no lugar errado. `prefers-reduced-motion` desliga tudo: o CSS
 * global já respeita isso.
 */
function NomeQuePassa({ texto }: { texto: string }) {
  const caixa = useRef<HTMLSpanElement>(null);
  const conteudo = useRef<HTMLSpanElement>(null);
  const [passa, setPassa] = useState(false);

  useEffect(() => {
    const c = caixa.current;
    const t = conteudo.current;
    if (!c || !t) return;
    setPassa(t.scrollWidth > c.clientWidth + 2);
  }, [texto]);

  return (
    <span ref={caixa} className="block w-full overflow-hidden text-left">
      <span
        ref={conteudo}
        className={[
          'inline-block whitespace-nowrap font-corpo text-[0.72rem] text-pergaminho/60',
          passa ? 'trilha-passando' : '',
        ].join(' ')}
      >
        {texto}
      </span>
    </span>
  );
}

/**
 * O volume em pé, aberto por um clique.
 *
 * Vertical porque o rádio é uma tira horizontal: uma barra deitada roubaria a
 * largura do nome, que é o único elemento que precisa dela. Em pé, ela sobe
 * por cima do aparelho e some quando termina.
 */
function BarraDeVolume({
  volume,
  aoMudar,
}: {
  volume: number;
  aoMudar: (v: number) => void;
}) {
  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 rounded-full border border-pergaminho/15 bg-tinta/95 backdrop-blur-md px-2 py-3 shadow-lg shadow-black/30">
      <span className="font-corpo text-[0.58rem] tabular-nums text-pergaminho/35">
        {Math.round(volume * 100)}
      </span>
      {/*
        Um `range` girado noventa graus: o controle nativo é o que já responde
        a teclado, leitor de tela e arrasto do dedo. Reimplementar isso à mão
        para conseguir a orientação seria trocar acessibilidade por estética.
      */}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => aoMudar(Number(e.target.value) / 100)}
        aria-label="Volume da trilha"
        className="w-24 h-1 accent-[var(--vela)] cursor-pointer -rotate-90"
        style={{ marginBlock: '2.5rem' }}
      />
    </div>
  );
}

/**
 * A lista, atrás do nome.
 *
 * As trancadas aparecem, apagadas, com cadeado — o que não aparece não vende,
 * e a faixa com nome e descrição é a própria oferta. Clicar numa delas leva
 * aos planos, que é a resposta honesta para "eu quero essa".
 */
function ListaDeTrilhas({
  trilhas,
  assinaturaAtiva,
  tocandoId,
  aoEscolher,
}: {
  trilhas: Trilha[];
  assinaturaAtiva: boolean;
  tocandoId: string | null;
  aoEscolher: (id: string) => void;
}) {
  return (
    <div className="w-full lg:w-[19rem] max-h-[46vh] overflow-y-auto rounded-2xl border border-pergaminho/15 bg-tinta/95 backdrop-blur-md shadow-2xl shadow-black/40 p-1.5 flex flex-col">
      {trilhas.map((trilha) => {
        const liberada = trilha.gratuita || assinaturaAtiva;

        if (!liberada) {
          return (
            <Link
              key={trilha.id}
              href="/planos"
              className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-pergaminho/5 transition-colors"
            >
              <Cadeado />
              <span className="font-corpo text-[0.76rem] text-pergaminho/35 group-hover:text-pergaminho/60 transition-colors truncate">
                {trilha.nome}
              </span>
            </Link>
          );
        }

        return (
          <button
            key={trilha.id}
            onClick={() => aoEscolher(trilha.id)}
            className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-pergaminho/5 transition-colors"
          >
            <span className="shrink-0 w-3 flex justify-center">
              {tocandoId === trilha.id ? <Ondas /> : <PontoPequeno />}
            </span>
            <span
              className={[
                'font-corpo text-[0.76rem] truncate transition-colors',
                tocandoId === trilha.id
                  ? 'text-vela'
                  : 'text-pergaminho/70 group-hover:text-pergaminho',
              ].join(' ')}
            >
              {trilha.nome}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── ícones ──────────────────────────────────────────────────────────────
   Desenhados aqui: um pacote de ícones inteiro para sete formas de 14px é
   peso de download que a pessoa paga sem receber nada em troca. */

function Play() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5-13-7.5Z" fill="currentColor" />
    </svg>
  );
}

function Pausa() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.4" fill="currentColor" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4" fill="currentColor" />
    </svg>
  );
}

function Proxima() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5v14l11-7L5 5Z" fill="currentColor" />
      <rect x="17.5" y="5" width="2.6" height="14" rx="1.3" fill="currentColor" />
    </svg>
  );
}

function Anterior() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 5v14L8 12l11-7Z" fill="currentColor" />
      <rect x="3.9" y="5" width="2.6" height="14" rx="1.3" fill="currentColor" />
    </svg>
  );
}

function AltoFalante({ mudo }: { mudo: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
      {mudo ? (
        <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M16.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Fechar() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Cadeado() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-pergaminho/25">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function PontoPequeno() {
  return <span className="block w-1 h-1 rounded-full bg-pergaminho/25" />;
}

/** Três barrinhas que sobem e descem — a faixa que está tocando agora. */
function Ondas() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="text-vela">
      <rect x="0.5" y="4" width="2.4" height="4" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="4;9;4" dur="1.1s" repeatCount="indefinite" />
        <animate attributeName="y" values="4;1.5;4" dur="1.1s" repeatCount="indefinite" />
      </rect>
      <rect x="4.8" y="2" width="2.4" height="8" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="8;3;8" dur="0.9s" repeatCount="indefinite" />
        <animate attributeName="y" values="2;4.5;2" dur="0.9s" repeatCount="indefinite" />
      </rect>
      <rect x="9.1" y="3.5" width="2.4" height="5" rx="1.2" fill="currentColor">
        <animate attributeName="height" values="5;9;5" dur="1.35s" repeatCount="indefinite" />
        <animate attributeName="y" values="3.5;1.5;3.5" dur="1.35s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}
