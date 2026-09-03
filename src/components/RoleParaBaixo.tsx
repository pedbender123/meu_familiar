'use client';

import { useEffect, useState } from 'react';

/**
 * O aviso de que a página continua.
 *
 * ── Por que isso existe ───────────────────────────────────────────────────
 *
 * O relato veio do time de marketing, e é o tipo de coisa que só aparece
 * quando alguém de fora olha: *"toda vez que eu entro nessa página eu fico
 * parado esperando alguma coisa acontecer"*. A primeira dobra do
 * `/seu-familiar/[id]` é o véu — uma imagem redonda, centralizada, com um
 * texto curto embaixo. Ela **parece uma tela inteira**, com começo, meio e
 * fim, e não há nenhum sinal de que abaixo dela existem os três sigilos, a
 * prova do teste e os preços. Quem sai dali sai sem nunca ter visto a oferta.
 *
 * ── Por que não é scroll automático ───────────────────────────────────────
 *
 * A outra ideia levantada foi a página descer sozinha. Não fizemos, e a razão
 * não é preguiça: no celular o scroll programático briga com o dedo da pessoa
 * — ela puxa, a página puxa de volta, e a sensação é de site quebrado ou de
 * anúncio. Também atropela quem lê devagar, que é justamente quem está
 * levando o ritual a sério. O problema relatado não era "a página não desce";
 * era "eu não sabia que tinha mais". Isso se resolve com um sinal, e o dedo
 * continua sendo de quem está lendo.
 *
 * ── O comportamento ───────────────────────────────────────────────────────
 *
 * Aparece depois de um respiro (a pessoa precisa ler o véu antes de ser
 * empurrada), e some no instante em que ela rola qualquer coisa — cumprida a
 * função, sai da frente. Não volta: quem já descobriu que a página desce não
 * precisa ser lembrado de novo.
 *
 * Clicar também desce, porque quem lê "role para baixo" num botão espera que
 * o botão faça isso. Desce menos de uma tela de propósito: sobra uma faixa do
 * que estava em cima, e essa sobra é o que diz para a pessoa que ela se moveu
 * dentro de um texto contínuo, em vez de ter pulado para outro lugar.
 */
export function RoleParaBaixo() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Se a pessoa já chegou rolada (voltou de outra aba, recarregou no meio),
    // o aviso não tem o que avisar.
    if (window.scrollY > 40) return;

    const aparecer = window.setTimeout(() => setVisivel(true), 2200);

    function aoRolar() {
      if (window.scrollY > 40) {
        window.clearTimeout(aparecer);
        setVisivel(false);
        window.removeEventListener('scroll', aoRolar);
      }
    }

    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.clearTimeout(aparecer);
      window.removeEventListener('scroll', aoRolar);
    };
  }, []);

  function descer() {
    setVisivel(false);
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({
      top: window.innerHeight * 0.82,
      behavior: suave ? 'smooth' : 'auto',
    });
  }

  return (
    <button
      type="button"
      onClick={descer}
      aria-hidden={!visivel}
      tabIndex={visivel ? 0 : -1}
      /*
        `left-1/2 -translate-x-1/2` em vez de `inset-x-0`: o botão do som mora
        no canto inferior direito (`AudioAmbiente`), e uma faixa de largura
        cheia cobriria ele.

        `mb-[env(safe-area-inset-bottom)]` para não nascer debaixo da barra do
        Safari no iPhone — que é o aparelho de onde veio o print.
      */
      className={[
        'fixed bottom-5 left-1/2 -translate-x-1/2 z-30',
        'mb-[env(safe-area-inset-bottom)]',
        'flex flex-col items-center gap-1.5 px-5 py-2.5 rounded-full',
        'border border-vela/30 bg-tinta/80 backdrop-blur-sm',
        'font-corpo text-[0.62rem] tracking-[0.22em] uppercase text-vela/80',
        'transition-opacity duration-700 chamando-para-baixo',
        visivel ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      role para baixo
      <svg
        width="14"
        height="9"
        viewBox="0 0 14 9"
        fill="none"
        aria-hidden="true"
        className="text-vela"
      >
        <path
          d="M1 1L7 7L13 1"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
