'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * O menu da área logada.
 *
 * Sem "em breve", sem cadeado, sem item desabilitado — SPEC 0.5.1 trata isso
 * como o erro mais comum e mais fácil de evitar: selo de recurso futuro lê-se
 * como produto inacabado. O Oráculo é um link normal; quem entrar é recebido
 * pela voz do familiar dizendo que ainda não é hora. Teaser dentro da ficção,
 * não na interface.
 */
const ITENS = [
  { href: '/conta', rotulo: 'Início' },
  { href: '/conta/oraculo', rotulo: 'Oráculo' },
];

export function MenuDaConta({ email }: { email: string }) {
  const caminho = usePathname();

  return (
    <header className="w-full max-w-3xl flex items-center justify-between gap-4 px-5 py-5 sm:py-7">
      <Link href="/conta" className="flex items-center gap-2.5 shrink-0 group">
        <svg width="20" height="34" viewBox="0 0 40 66" aria-hidden="true">
          <rect x="18" y="42" width="4" height="18" rx="2" fill="var(--pergaminho)" opacity="0.75" />
          <g className="chama-tremula" style={{ transformOrigin: '20px 42px' }}>
            <path d="M20 6 C9 24, 6 34, 20 42 C34 34, 31 24, 20 6 Z" fill="var(--vela)" />
          </g>
        </svg>
        <span className="font-corpo text-[0.62rem] tracking-[0.24em] uppercase text-violeta group-hover:text-vela transition-colors">
          Bruxário
        </span>
      </Link>

      <nav className="flex items-center gap-1 sm:gap-2">
        {ITENS.map((item) => {
          const ativo = caminho === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={[
                'font-corpo text-sm px-3 py-2 rounded-full transition-colors',
                ativo
                  ? 'text-vela'
                  : 'text-pergaminho/55 hover:text-pergaminho',
              ].join(' ')}
            >
              {item.rotulo}
            </Link>
          );
        })}

        <Link
          href="/conta/perfil"
          aria-label={`Perfil de ${email}`}
          title={email}
          className={[
            'ml-1 inline-flex items-center justify-center w-9 h-9 rounded-full border transition-colors',
            caminho === '/conta/perfil'
              ? 'border-vela text-vela'
              : 'border-pergaminho/20 text-pergaminho/60 hover:border-pergaminho/45 hover:text-pergaminho',
          ].join(' ')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}
