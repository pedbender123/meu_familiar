import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, Wand2, Mail } from 'lucide-react';
import { RodapeLegal } from '@/components/RodapeLegal';

const EXEMPLOS = [
  { src: '/exemplos/exemplo-corvo.png', alt: 'Prévia borrada de uma arte do Corvo' },
  { src: '/exemplos/exemplo-mariposa.png', alt: 'Prévia borrada de uma arte da Mariposa' },
  { src: '/exemplos/exemplo-gata.png', alt: 'Prévia borrada de uma arte da Gata Preta' },
];

export default function Landing() {
  return (
    <main className="flex-1 flex flex-col items-center">
      <section className="w-full max-w-2xl px-6 pt-16 pb-10 text-center flex flex-col items-center gap-6">
        <span className="font-corpo text-xs tracking-[0.3em] text-violeta uppercase">
          Bruxário
        </span>
        <h1 className="font-display italic text-4xl sm:text-5xl leading-tight text-pergaminho">
          Toda bruxa tem um familiar.
          <br />O seu já te escolheu.
        </h1>
        <p className="font-corpo font-light text-pergaminho/80 text-lg max-w-md">
          Você só ainda não sabe qual é. Um ritual atmosférico revela quem
          caminha ao seu lado — e o nome secreto que ele carrega só para você.
        </p>
        <Link
          href="/ritual"
          className="mt-2 inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition"
        >
          <Sparkles size={18} strokeWidth={1.75} />
          Começar o ritual
        </Link>
      </section>

      <section className="w-full max-w-4xl px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {EXEMPLOS.map((ex) => (
            <div key={ex.src} className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-pergaminho/10">
              <Image
                src={ex.src}
                alt={ex.alt}
                fill
                className="object-cover blur-md scale-105"
              />
              <div className="absolute inset-0 bg-tinta/30" />
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-pergaminho/50 mt-3 font-corpo">
          três revelações reais, veladas até o ritual ser seu
        </p>
      </section>

      <section className="w-full max-w-2xl px-6 py-12">
        <h2 className="font-display italic text-2xl text-center text-pergaminho mb-8">
          Como funciona
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Wand2 size={28} strokeWidth={1.5} className="text-vela" />
            <p className="font-corpo font-light text-sm text-pergaminho/80">
              Responda ao ritual atmosférico — leva menos de 3 minutos.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Sparkles size={28} strokeWidth={1.5} className="text-vela" />
            <p className="font-corpo font-light text-sm text-pergaminho/80">
              Encontramos seu familiar e revelamos assim que o ritual se completa.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <Mail size={28} strokeWidth={1.5} className="text-vela" />
            <p className="font-corpo font-light text-sm text-pergaminho/80">
              A leitura, o nome secreto e as artes ficam guardados no seu link
              — para sempre.
            </p>
          </div>
        </div>
      </section>

      <RodapeLegal />
    </main>
  );
}
