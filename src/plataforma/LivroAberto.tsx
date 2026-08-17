'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { gerarGrao } from '@/lib/grao';
import type { ItemDeMenu } from '@/nucleo/modulos';

/**
 * A plataforma como um **grimório aberto**.
 *
 * ── A inversão em relação ao resto do site ────────────────────────────────
 *
 * Na venda, `FolhaPergaminho` é um objeto sobre a mesa e o fundo é o quarto
 * escuro — luz de vela, sussurro, ambientação. Aqui não: quem já entrou não
 * está sendo seduzido, está **usando** o grimório. Então o papel deixa de ser
 * objeto e vira o chão da tela, e a interface passa a morar dentro dele.
 *
 * Não é a mesma regra aplicada em outro lugar, é a regra oposta — e de
 * propósito. Fundo escuro liso lê como aplicativo genérico com tema noturno;
 * um livro aberto de duas páginas lê como a coisa que o produto diz ser.
 *
 * ── A lombada faz o trabalho do menu ──────────────────────────────────────
 *
 * Num livro real, o sumário não é uma barra: é a página da esquerda. É isso
 * que a lateral é aqui — uma coluna de capítulos manuscritos, com a sombra da
 * dobra separando as duas metades. Capítulo sem direito continua listado e
 * mais apagado, como entrada de índice para página que a pessoa ainda não
 * abriu; sumir com ele esconderia que o livro tem mais.
 *
 * ── No celular, livro não abre ────────────────────────────────────────────
 *
 * Duas páginas lado a lado num telefone dariam duas colunas ilegíveis. Então
 * o celular mostra **uma página só**, e o sumário vira a fita de marcador na
 * base — mesma metáfora, formato que cabe na mão.
 */
export interface ItemDoSumario extends ItemDeMenu {
  numero: string;
}

/** Papel com fibra: o mesmo grão de `FolhaPergaminho`, aplicado à página inteira. */
function Fibra({ opacidade = 0.45 }: { opacidade?: number }) {
  const el = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const alvo = el.current;
    if (!alvo) return;
    const grao = gerarGrao();
    if (grao) alvo.style.backgroundImage = `url(${grao})`;
  }, []);

  return (
    <span
      ref={el}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundRepeat: 'repeat',
        mixBlendMode: 'multiply',
        opacity: opacidade,
      }}
    />
  );
}

export function LivroAberto({
  itens,
  email,
  children,
}: {
  itens: ItemDoSumario[];
  email: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const ativo = (rota: string) =>
    rota === '/conta' ? caminho === '/conta' : caminho.startsWith(rota);

  return (
    <div
      className="relative z-10 flex-1 flex justify-center px-0 py-0 lg:px-8 lg:py-8"
      style={{
        // A mesa em que o livro está apoiado. Escura, mas quente — ela não é
        // o produto, é só o que sobra em volta dele nas telas largas.
        background:
          'radial-gradient(ellipse 70% 55% at 50% 30%, #241b2e 0%, #100c1a 75%)',
      }}
    >
      <div
        className="relative w-full max-w-6xl flex flex-1 min-h-0 overflow-hidden lg:rounded-sm"
        style={{
          background: 'var(--folha)',
          boxShadow: [
            '0 2px 0 rgba(0,0,0,0.2)',
            '0 40px 80px -24px rgba(0,0,0,0.8)',
            '0 0 120px -40px rgba(217,164,65,0.22)',
          ].join(', '),
        }}
      >
        <Fibra />

        {/* ── Página da esquerda: o sumário (só quando o livro abre) ───── */}
        <nav
          className="hidden lg:flex relative w-[16.5rem] shrink-0 flex-col gap-7 px-9 py-10"
          style={{
            // A página esquerda recebe menos luz: a dobra do meio a sombreia.
            background:
              'linear-gradient(to right, rgba(90,66,30,0.11) 0%, transparent 22%, transparent 82%, rgba(90,66,30,0.16) 100%)',
          }}
        >
          <Link href="/conta" className="flex flex-col gap-1 group">
            <span className="font-ritual text-3xl text-ouro-profundo leading-none">
              Bruxário
            </span>
            <span className="font-corpo text-[0.55rem] tracking-[0.3em] uppercase text-escrita-fraca">
              seu grimório
            </span>
          </Link>

          <hr className="h-px border-0 bg-gradient-to-r from-escrita/25 to-transparent" />

          <ul className="flex flex-col gap-0.5">
            {itens.map((item) => (
              <li key={item.rota}>
                <Link
                  href={item.rota}
                  aria-current={ativo(item.rota) ? 'page' : undefined}
                  className={[
                    'group flex items-baseline gap-3 py-2.5 transition-colors',
                    ativo(item.rota)
                      ? 'text-ouro-profundo'
                      : item.liberado
                        ? 'text-escrita-corpo hover:text-ouro-profundo'
                        : 'text-escrita-fraca/55 hover:text-escrita-fraca',
                  ].join(' ')}
                >
                  <span className="font-ritual text-lg w-5 shrink-0 opacity-70">
                    {item.numero}
                  </span>
                  <span className="font-display italic text-lg leading-tight">
                    {item.rotulo}
                  </span>
                  {/* A linha pontilhada de sumário de livro, preenchendo até a borda. */}
                  <span
                    aria-hidden="true"
                    className="flex-1 self-center h-px opacity-30"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to right, currentColor 0 2px, transparent 2px 6px)',
                    }}
                  />
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/conta/perfil"
            title={email}
            className={[
              'mt-auto font-corpo text-[0.68rem] leading-relaxed truncate transition-colors',
              ativo('/conta/perfil')
                ? 'text-ouro-profundo'
                : 'text-escrita-fraca hover:text-escrita-corpo',
            ].join(' ')}
          >
            {email}
          </Link>
        </nav>

        {/*
          A dobra. Duas sombras encostadas em vez de uma linha: papel dobrado
          não tem borda, tem um vale — e é o vale que faz o olho aceitar que
          são duas páginas do mesmo objeto, e não dois blocos lado a lado.
        */}
        <div
          aria-hidden="true"
          className="hidden lg:block w-8 shrink-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(74,53,22,0.20) 0%, rgba(74,53,22,0.05) 32%, rgba(255,250,235,0.35) 50%, rgba(74,53,22,0.05) 68%, rgba(74,53,22,0.20) 100%)',
          }}
        />

        {/* ── Página da direita: o conteúdo ───────────────────────────── */}
        <div className="relative flex-1 min-w-0 flex flex-col">
          {/* Cabeçalho só no celular — no desktop o sumário já identifica o livro. */}
          <header className="lg:hidden flex items-center justify-between px-6 pt-6 pb-2">
            <Link href="/conta" className="font-ritual text-2xl text-ouro-profundo leading-none">
              Bruxário
            </Link>
            <Link
              href="/conta/perfil"
              aria-label={`Perfil de ${email}`}
              className={[
                'font-corpo text-[0.6rem] tracking-[0.18em] uppercase transition-colors',
                ativo('/conta/perfil') ? 'text-ouro-profundo' : 'text-escrita-fraca',
              ].join(' ')}
            >
              perfil
            </Link>
          </header>

          <main className="flex-1 min-h-0 flex flex-col items-center px-6 pt-4 pb-28 sm:px-10 lg:px-14 lg:py-12 text-escrita overflow-y-auto">
            {children}
          </main>
        </div>

        {/*
          A fita de marcador — o sumário do celular. Fica sobre o papel, na
          base, com `env(safe-area-inset-bottom)` pra não cair embaixo do
          indicador de gestos do iPhone.
        */}
        <nav
          className="lg:hidden absolute bottom-0 inset-x-0 flex items-stretch justify-around border-t border-escrita/15"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom)',
            background: 'linear-gradient(to top, rgba(198,180,146,0.55), rgba(214,198,166,0.3))',
            backdropFilter: 'blur(2px)',
          }}
        >
          {itens.map((item) => (
            <Link
              key={item.rota}
              href={item.rota}
              aria-current={ativo(item.rota) ? 'page' : undefined}
              className={[
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                ativo(item.rota)
                  ? 'text-ouro-profundo'
                  : item.liberado
                    ? 'text-escrita-corpo/75'
                    : 'text-escrita-fraca/50',
              ].join(' ')}
            >
              <span className="font-ritual text-base leading-none">{item.numero}</span>
              <span className="font-corpo text-[0.58rem] tracking-wide">{item.rotulo}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
