import Link from 'next/link';
import type { ReactNode } from 'react';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { RodapeLegal } from '@/components/RodapeLegal';
import { LEGAL } from '@/lib/legal';

/**
 * Moldura das páginas legais.
 *
 * Elas ficam no pergaminho, como o resto do conteúdo — documento legal ilegível
 * é dark pattern: enfraquece o próprio aviso e lê como má-fé se alguém
 * reclamar. Texto escuro sobre papel claro, tamanho normal, sem parede de
 * maiúsculas.
 */
export function PaginaLegal({
  titulo,
  resumo,
  children,
}: {
  titulo: string;
  resumo: string;
  children: ReactNode;
}) {
  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-8 px-5 py-12">
        <FolhaPergaminho>
          <h1 className="font-display italic text-3xl sm:text-4xl text-escrita text-center text-balance">
            {titulo}
          </h1>
          <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[46ch] leading-relaxed">
            {resumo}
          </p>
          <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

          <div className="flex flex-col gap-7 self-stretch max-w-[62ch] mx-auto">
            {children}
          </div>

          <p className="font-corpo font-light text-xs text-escrita-fraca text-center pt-4">
            Última atualização: {LEGAL.atualizadoEm}. Se mudarmos algo
            relevante, avisamos por e-mail antes de valer.
          </p>
        </FolhaPergaminho>

        <div className="flex items-center gap-4">
          <Link
            href="/termos"
            className="font-corpo text-sm text-pergaminho/55 underline underline-offset-4 hover:text-vela transition-colors"
          >
            Termos de uso
          </Link>
          <Link
            href="/privacidade"
            className="font-corpo text-sm text-pergaminho/55 underline underline-offset-4 hover:text-vela transition-colors"
          >
            Privacidade
          </Link>
          <Link
            href="/contato"
            className="font-corpo text-sm text-pergaminho/55 underline underline-offset-4 hover:text-vela transition-colors"
          >
            Falar com a gente
          </Link>
        </div>

        <RodapeLegal />
      </main>
    </>
  );
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-corpo font-medium text-base text-escrita">{titulo}</h2>
      <div className="flex flex-col gap-2.5 font-corpo font-light text-sm text-escrita-corpo leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function Lista({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5 pl-4">
      {itens.map((item, i) => (
        <li key={i} className="list-disc marker:text-ouro-velho">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Destaque({ children }: { children: ReactNode }) {
  return (
    <p className="font-corpo text-sm leading-relaxed text-escrita bg-ouro-velho/10 border-l-2 border-ouro-velho/50 rounded-r-lg px-4 py-3">
      {children}
    </p>
  );
}
