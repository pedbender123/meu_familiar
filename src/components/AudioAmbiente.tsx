'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { alternarMudo, aoMudarMudo, estaMudo } from '@/lib/som';

/**
 * Chuva e vela em loop, baixinho, por trás do site inteiro.
 *
 * ── Por que só começa depois de um clique ─────────────────────────────────
 *
 * Todo navegador bloqueia áudio com som antes de qualquer gesto do usuário —
 * tentar tocar antes disso falha silenciosamente. Em vez de lutar contra
 * isso, o componente escuta o primeiro clique/toque da página inteira e só
 * aí inicia os dois loops.
 *
 * ── Por que dois elementos, e não um arquivo só ────────────────────────────
 *
 * Chuva e vela são texturas separadas que o usuário pode ter gravado em
 * volumes diferentes; tocar as duas como `<audio loop>` independentes deixa
 * o volume relativo ajustável aqui, sem precisar remixar o arquivo.
 */
const VOLUME_AMBIENTE = 0.5;

export function AudioAmbiente() {
  const caminho = usePathname();
  const chuva = useRef<HTMLAudioElement>(null);
  const vela = useRef<HTMLAudioElement>(null);
  // `localStorage` é um sistema externo ao React — `useSyncExternalStore` lê
  // o valor atual e reassina no evento de mudança sem o vaivém de efeito +
  // setState (que trocaria o ícone depois do primeiro paint e cascatearia
  // um render extra).
  const mudo = useSyncExternalStore(
    (ouvir) => aoMudarMudo(() => ouvir()),
    estaMudo,
    () => false
  );
  const [iniciado, setIniciado] = useState(false);

  // `volume` não é um atributo HTML — só existe na propriedade do elemento,
  // então precisa ser setado imperativamente, não via JSX.
  useEffect(() => {
    if (chuva.current) chuva.current.volume = VOLUME_AMBIENTE;
    if (vela.current) vela.current.volume = VOLUME_AMBIENTE;
  }, []);

  useEffect(() => {
    function comecar() {
      if (iniciado) return;
      setIniciado(true);
      if (!estaMudo()) {
        chuva.current?.play().catch(() => {});
        vela.current?.play().catch(() => {});
      }
    }
    window.addEventListener('pointerdown', comecar, { once: true });
    window.addEventListener('keydown', comecar, { once: true });
    return () => {
      window.removeEventListener('pointerdown', comecar);
      window.removeEventListener('keydown', comecar);
    };
  }, [iniciado]);

  useEffect(() => {
    if (mudo) {
      chuva.current?.pause();
      vela.current?.pause();
    } else if (iniciado) {
      chuva.current?.play().catch(() => {});
      vela.current?.play().catch(() => {});
    }
  }, [mudo, iniciado]);

  /**
   * O painel não é o quarto de vela — é ferramenta de trabalho.
   *
   * Chuva e vela crepitando enquanto se olha taxa do Mercado Pago não
   * ambienta nada, só atrapalha. O `return null` vem DEPOIS dos hooks porque
   * a ordem deles não pode variar entre renders; os elementos de áudio somem
   * junto, então nada continua tocando ao entrar no painel.
   */
  if (caminho?.startsWith('/painel')) return null;

  /**
   * Dentro da conta quem manda no som é a pessoa.
   *
   * A plataforma tem tocador próprio (`plataforma/Radio.tsx`), com lista de
   * faixas e volume. Deixar o ambiente rodando junto seria chuva por cima de
   * chuva — literalmente, já que a primeira faixa do catálogo é este mesmo
   * arquivo — e dois controles de som na mesma tela, cada um ignorando o
   * outro.
   */
  if (caminho?.startsWith('/conta')) return null;

  return (
    <>
      <audio ref={chuva} src="/audio/chuva.mp3" loop preload="auto" />
      <audio ref={vela} src="/audio/vela.mp3" loop preload="auto" />
      <BotaoDeSom mudo={mudo} onClick={() => alternarMudo()} />
    </>
  );
}

function BotaoDeSom({ mudo, onClick }: { mudo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={mudo ? 'Ativar som' : 'Silenciar som'}
      aria-pressed={mudo}
      className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full border border-pergaminho/20 bg-tinta/70 backdrop-blur-sm text-pergaminho/70 hover:text-vela hover:border-vela/50 transition flex items-center justify-center"
    >
      {mudo ? <IconeMudo /> : <IconeSom />}
    </button>
  );
}

function IconeSom() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
      <path
        d="M16.5 8.5a5 5 0 0 1 0 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M19 6a9 9 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function IconeMudo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4Z" fill="currentColor" />
      <path
        d="M16 9l5 6M21 9l-5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
