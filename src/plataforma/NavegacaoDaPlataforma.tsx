'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ItemDeMenu } from '@/nucleo/modulos';

/**
 * A navegação da plataforma (Fase 5 de docs/reestruturacao.md).
 *
 * **Duas formas, um só componente**: barra lateral fixa a partir de `lg`,
 * barra inferior no celular. Não é responsividade decorativa — a lateral é
 * inutilizável num telefone e a barra inferior desperdiça a tela de um
 * monitor.
 *
 * **Item sem direito aparece apagado, não some** (seção da Fase 5): item que
 * some é oportunidade de upgrade perdida. Mas o rótulo não ganha cadeado nem
 * "em breve" — o SPEC 0.5.1 trata selo de recurso futuro como o erro que faz
 * o produto parecer inacabado. O item simplesmente está mais quieto, e quem
 * clica é recebido pela ficção.
 */
export interface ItemDeNavegacao extends ItemDeMenu {
  icone: 'inicio' | 'oraculo' | 'familiar' | 'horoscopo' | 'biblioteca' | 'perfil';
}

const ICONES: Record<ItemDeNavegacao['icone'], React.ReactNode> = {
  inicio: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6.5 10.5V20h11v-9.5" />
    </>
  ),
  oraculo: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5v15M4.5 12h15" opacity="0.45" />
    </>
  ),
  familiar: (
    <>
      <path d="M12 20.5s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 3.1c0 5-7 9.4-7 9.4Z" />
    </>
  ),
  horoscopo: (
    <>
      <path d="M12 3.5 13.9 9.4h6.2l-5 3.7 1.9 6-5-3.7-5 3.7 1.9-6-5-3.7h6.2Z" />
    </>
  ),
  /* Um livro aberto, do mesmo traço fino do resto. */
  biblioteca: (
    <>
      <path d="M12 6.8C10.4 5.6 8.4 5 6 5H3.5v12.5H6c2.4 0 4.4.6 6 1.8" />
      <path d="M12 6.8C13.6 5.6 15.6 5 18 5h2.5v12.5H18c-2.4 0-4.4.6-6 1.8" />
      <path d="M12 6.8v12.5" opacity="0.45" />
    </>
  ),
  perfil: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
    </>
  ),
};

function Icone({ nome }: { nome: ItemDeNavegacao['icone'] }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONES[nome]}
    </svg>
  );
}

function Marca() {
  return (
    <Link href="/conta" className="flex items-center gap-2.5 group">
      <svg width="18" height="30" viewBox="0 0 40 66" aria-hidden="true">
        <rect x="18" y="42" width="4" height="18" rx="2" fill="var(--pergaminho)" opacity="0.75" />
        <g className="chama-tremula" style={{ transformOrigin: '20px 42px' }}>
          <path d="M20 6 C9 24, 6 34, 20 42 C34 34, 31 24, 20 6 Z" fill="var(--vela)" />
        </g>
      </svg>
      <span className="font-corpo text-[0.62rem] tracking-[0.24em] uppercase text-violeta group-hover:text-vela transition-colors">
        Bruxário
      </span>
    </Link>
  );
}

export function NavegacaoDaPlataforma({
  itens,
  email,
}: {
  itens: ItemDeNavegacao[];
  email: string;
}) {
  const caminho = usePathname();
  const ativo = (rota: string) =>
    rota === '/conta' ? caminho === '/conta' : caminho.startsWith(rota);

  return (
    <>
      {/* ── Barra lateral (lg+) ──────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col gap-8 px-6 py-8 border-r border-pergaminho/10 z-20">
        <Marca />

        <nav className="flex flex-col gap-1">
          {itens.map((item) => (
            <Link
              key={item.rota}
              href={item.rota}
              aria-current={ativo(item.rota) ? 'page' : undefined}
              className={[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg font-corpo text-sm transition-colors',
                ativo(item.rota)
                  ? 'text-vela bg-pergaminho/[0.06]'
                  : item.liberado
                    ? 'text-pergaminho/65 hover:text-pergaminho hover:bg-pergaminho/[0.04]'
                    : 'text-pergaminho/30 hover:text-pergaminho/50',
              ].join(' ')}
            >
              <Icone nome={item.icone} />
              {item.rotulo}
            </Link>
          ))}
        </nav>

        <Link
          href="/conta/perfil"
          title={email}
          className={[
            'mt-auto flex items-center gap-3 px-3 py-2.5 rounded-lg font-corpo text-sm transition-colors',
            ativo('/conta/perfil')
              ? 'text-vela bg-pergaminho/[0.06]'
              : 'text-pergaminho/50 hover:text-pergaminho',
          ].join(' ')}
        >
          <Icone nome="perfil" />
          <span className="truncate">{email}</span>
        </Link>
      </aside>

      {/* ── Topo enxuto (só no celular, a barra de baixo é quem navega) ── */}
      <header className="lg:hidden w-full flex items-center justify-between px-5 py-4">
        <Marca />
        <Link
          href="/conta/perfil"
          aria-label={`Perfil de ${email}`}
          title={email}
          className={[
            'inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors',
            ativo('/conta/perfil')
              ? 'border-vela text-vela'
              : 'border-pergaminho/20 text-pergaminho/60',
          ].join(' ')}
        >
          <Icone nome="perfil" />
        </Link>
      </header>

      {/*
        Barra inferior do celular. `env(safe-area-inset-bottom)` é o que
        impede a barra de ficar embaixo do indicador de gestos do iPhone —
        sem isso o último item vira inclicável nos aparelhos mais novos.
      */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around border-t border-pergaminho/10 bg-quarto/95 backdrop-blur-sm"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {itens.map((item) => (
          <Link
            key={item.rota}
            href={item.rota}
            aria-current={ativo(item.rota) ? 'page' : undefined}
            className={[
              'flex-1 flex flex-col items-center gap-1 py-2.5 font-corpo text-[0.6rem] tracking-wide transition-colors',
              ativo(item.rota)
                ? 'text-vela'
                : item.liberado
                  ? 'text-pergaminho/55'
                  : 'text-pergaminho/25',
            ].join(' ')}
          >
            <Icone nome={item.icone} />
            {item.rotulo}
          </Link>
        ))}
      </nav>
    </>
  );
}
