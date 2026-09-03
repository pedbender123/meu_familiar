import Link from 'next/link';
import { MarcoDeEntrada } from '@/components/landing/MarcoDeEntrada';
import { RitualLongo } from './RitualLongo';

export const metadata = {
  title: 'Descubra seu familiar — Bruxário',
  description: 'Descubra qual dos 12 animais guarda a sua natureza, com o seu Sol e a sua Lua na leitura.',
};

export const dynamic = 'force-dynamic';

/**
 * O funil longo, em rota própria e publicável.
 *
 * `bruxario.com.br/familiar` fala por si em legenda de vídeo e em bio — coisa
 * que `?f=fa` não faz. O código curto continua existindo para o link de
 * anúncio dirigido e para o sorteio do teste; este caminho é o nome humano da
 * mesma coisa.
 *
 * A raiz `/` não é tocada: quem digita o endereço, foi indicado ou volta
 * depois de comprar continua caindo na landing expositiva com as 26 cenas.
 * Ver `lib/funis.ts`.
 */
export default function Familiar() {
  return (
    <>
      <MarcoDeEntrada />
      <RitualLongo hero={<Hero />} rodape={<RodapeMinimo />} />
    </>
  );
}

function Hero() {
  return (
    <h1 className="font-display italic text-3xl sm:text-5xl leading-[1.12] text-pergaminho text-center text-balance max-w-[16ch] anima-surgir">
      Existe um familiar que já anda com você.
    </h1>
  );
}

function RodapeMinimo() {
  return (
    <div className="flex flex-col items-center gap-3 mt-12 pt-6 max-w-[42ch]">
      {/*
        O aviso desceu para cá.

        Ele estava colado no título, e três parágrafos antes da primeira
        pergunta empurravam o funil para baixo da dobra no celular — a pessoa
        chegava e via texto, não a coisa para fazer. A exigência é que ele
        seja acessível e legível, não que seja a primeira coisa lida; no
        rodapé ele cumpre as duas sem competir com a abertura.
      */}
      <p className="font-corpo text-[11px] leading-relaxed text-pergaminho/40 text-center">
        Retrato simbólico, não teste psicológico nem diagnóstico.
      </p>
      <div className="flex items-center gap-4">
        <Link href="/termos" className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition">
          Termos
        </Link>
        <span className="text-pergaminho/20">·</span>
        <Link href="/privacidade" className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition">
          Privacidade
        </Link>
      </div>
    </div>
  );
}
