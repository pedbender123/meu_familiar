'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import {
  assinarPreferencias,
  gravarRecolhida,
  gravarTema,
  lerRecolhida,
  lerTema,
  RECOLHIDA_PADRAO,
  TEMA_PADRAO,
} from '@/lib/preferencias-admin';

/**
 * A moldura do painel: barra lateral que recolhe, tema claro/escuro e o
 * cabeçalho da área aberta.
 *
 * ── Por que o estado mora no localStorage, e não numa sessão ──────────────
 *
 * Barra recolhida e tema são preferência de quem está olhando, não dado do
 * negócio. Guardar no banco exigiria uma escrita a cada clique e viajaria
 * entre dispositivos onde a escolha nem faz sentido (recolhida no notebook,
 * aberta no monitor grande).
 *
 * ── O piscar de tema ──────────────────────────────────────────────────────
 *
 * O tema só é conhecido depois que o JavaScript roda, então o primeiro quadro
 * sairia sempre escuro e trocaria na frente de quem escolheu claro. O
 * `<script>` inline no `layout.tsx` resolve isso: ele aplica o atributo antes
 * da primeira pintura. Aqui a gente só sincroniza o React com o que já está
 * no DOM.
 */

export interface Area {
  href: string;
  rotulo: string;
  icone: keyof typeof ICONES;
  /** Aparece coladinho no rótulo — contagem que pede atenção. */
  alerta?: number;
}

export function Shell({
  areas,
  email,
  children,
}: {
  areas: Area[];
  email: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const [menuMovel, setMenuMovel] = useState(false);

  const tema = useSyncExternalStore(assinarPreferencias, lerTema, () => TEMA_PADRAO);
  const recolhida = useSyncExternalStore(
    assinarPreferencias,
    lerRecolhida,
    () => RECOLHIDA_PADRAO
  );

  const areaAtual = areas.find(
    (a) => caminho === a.href || caminho.startsWith(a.href + '/')
  );

  return (
    <div className="flex min-h-screen">
      <aside
        className={[
          'superficie shrink-0 flex-col justify-between border-r transition-[width] duration-200 sticky top-0 h-screen',
          'hidden sm:flex',
          recolhida ? 'w-[4.25rem]' : 'w-56',
        ].join(' ')}
        style={{ borderColor: 'var(--admin-borda)' }}
      >
        <div className="flex flex-col gap-1 p-3">
          <div className={`flex items-center gap-2 px-2 py-3 ${recolhida ? 'justify-center' : ''}`}>
            <Chama />
            {!recolhida && (
              <span className="font-display italic text-lg text-pergaminho truncate">
                Bruxário
              </span>
            )}
          </div>

          <nav className="flex flex-col gap-0.5 mt-1">
            {areas.map((a) => (
              <ItemDoMenu key={a.href} area={a} ativo={a === areaAtual} recolhida={recolhida} />
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1 p-3">
          <BotaoDaBarra
            onClick={() => gravarTema(tema === 'escuro' ? 'claro' : 'escuro')}
            icone={tema === 'escuro' ? 'sol' : 'lua'}
            rotulo={tema === 'escuro' ? 'Modo claro' : 'Modo escuro'}
            recolhida={recolhida}
          />
          <BotaoDaBarra
            onClick={() => gravarRecolhida(!recolhida)}
            icone={recolhida ? 'abrir' : 'fechar'}
            rotulo="Recolher"
            recolhida={recolhida}
          />
          {!recolhida && (
            <p className="font-corpo text-[10px] text-pergaminho/35 px-3 pt-2 truncate">
              {email}
            </p>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* barra do topo: no celular ela carrega o menu inteiro */}
        <header
          className="superficie sticky top-0 z-30 border-b flex items-center gap-3 px-4 py-3"
          style={{ borderColor: 'var(--admin-borda)' }}
        >
          <button
            onClick={() => setMenuMovel((m) => !m)}
            className="sm:hidden text-pergaminho/60 hover:text-vela transition"
            aria-label="Abrir menu"
          >
            <Icone nome="menu" />
          </button>

          <h1 className="font-corpo font-medium text-sm text-pergaminho">
            {areaAtual?.rotulo ?? 'Painel'}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="font-corpo text-[11px] text-pergaminho/45 hover:text-vela transition"
            >
              ver o site ↗
            </Link>
            <form action="/api/auth/sair" method="post">
              <button
                type="submit"
                className="font-corpo text-[11px] text-pergaminho/45 hover:text-vela transition"
              >
                sair
              </button>
            </form>
          </div>
        </header>

        {menuMovel && (
          <nav
            className="superficie sm:hidden border-b flex flex-col gap-0.5 p-3"
            style={{ borderColor: 'var(--admin-borda)' }}
          >
            {areas.map((a) => (
              <ItemDoMenu key={a.href} area={a} ativo={a === areaAtual} recolhida={false} />
            ))}
          </nav>
        )}

        <main className="flex-1 px-4 sm:px-6 py-5">{children}</main>
      </div>
    </div>
  );
}

function ItemDoMenu({
  area,
  ativo,
  recolhida,
}: {
  area: Area;
  ativo: boolean;
  recolhida: boolean;
}) {
  return (
    <Link
      href={area.href}
      title={recolhida ? area.rotulo : undefined}
      className={[
        'flex items-center gap-2.5 rounded-lg px-3 py-2 font-corpo text-[13px] transition',
        recolhida ? 'justify-center' : '',
        ativo
          ? 'bg-vela/12 text-vela'
          : 'text-pergaminho/60 hover:text-pergaminho hover:bg-pergaminho/[0.06]',
      ].join(' ')}
    >
      <Icone nome={area.icone} />
      {!recolhida && <span className="truncate">{area.rotulo}</span>}
      {!recolhida && !!area.alerta && area.alerta > 0 && (
        <span className="ml-auto font-corpo text-[10px] tabular-nums px-1.5 py-0.5 rounded-full bg-vela text-tinta">
          {area.alerta}
        </span>
      )}
      {recolhida && !!area.alerta && area.alerta > 0 && (
        <span className="absolute w-1.5 h-1.5 rounded-full bg-vela translate-x-3 -translate-y-2" />
      )}
    </Link>
  );
}

function BotaoDaBarra({
  onClick,
  icone,
  rotulo,
  recolhida,
}: {
  onClick: () => void;
  icone: keyof typeof ICONES;
  rotulo: string;
  recolhida: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={recolhida ? rotulo : undefined}
      className={[
        'flex items-center gap-2.5 rounded-lg px-3 py-2 font-corpo text-[13px] transition',
        'text-pergaminho/50 hover:text-pergaminho hover:bg-pergaminho/[0.06]',
        recolhida ? 'justify-center' : '',
      ].join(' ')}
    >
      <Icone nome={icone} />
      {!recolhida && <span>{rotulo}</span>}
    </button>
  );
}

/* ── ícones ───────────────────────────────────────────────────────────────
   Desenhados aqui em vez de importados: são nove traços, e uma biblioteca de
   ícones custaria mais bytes que a página inteira do painel. */

const ICONES = {
  grafico: 'M4 19V5M4 19h16M8 16V9M12 16v-4M16 16V7',
  megafone: 'M4 10v4h3l6 4V6L7 10H4ZM17 9a4 4 0 0 1 0 6',
  alvo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 11.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1Z',
  caixa: 'M4 8l8-4 8 4v8l-8 4-8-4V8ZM4 8l8 4M20 8l-8 4M12 12v8',
  etiqueta: 'M4 4h7l9 9-7 7-9-9V4ZM8 8h.01',
  carta: 'M3 6h18v12H3V6ZM3 7l9 6 9-6',
  estrela: 'M12 3l2.6 5.8 6.4.7-4.8 4.3 1.3 6.2L12 17l-5.5 3 1.3-6.2L3 9.5l6.4-.7L12 3Z',
  moeda: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7',
  sol: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  lua: 'M20 14a8 8 0 1 1-9.9-9.9A7 7 0 0 0 20 14Z',
  abrir: 'M9 6l6 6-6 6',
  fechar: 'M15 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
} as const;

function Icone({ nome }: { nome: keyof typeof ICONES }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      className="shrink-0">
      <path d={ICONES[nome]} stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chama() {
  return (
    <svg width="18" height="18" viewBox="0 0 40 66" aria-hidden="true" className="shrink-0">
      <path d="M20 6 C9 24, 6 34, 20 42 C34 34, 31 24, 20 6 Z" fill="var(--vela)" />
    </svg>
  );
}
