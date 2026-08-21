import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao-servidor';

export const dynamic = 'force-dynamic';

/**
 * A moldura do painel — deliberadamente pequena.
 *
 * O painel aqui serve a uma pergunta só: *"as vendas estão chegando e sendo
 * entregues?"*. Não é ferramenta de análise, não mede campanha e não gerencia
 * catálogo — quem quiser isso conecta o que preferir por fora.
 *
 * Sem sessão o layout some e cada página cuida de si: a de entrar se desenha
 * inteira, as outras redirecionam.
 */
export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col bg-tinta">
      <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-pergaminho/10">
        <Link
          href="/painel/pedidos"
          className="font-corpo text-[0.62rem] tracking-[0.24em] uppercase text-vela"
        >
          Painel
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-corpo text-xs text-pergaminho/40">{sessao.email}</span>
          <form action="/api/auth/sair" method="post">
            <button className="font-corpo text-xs text-pergaminho/40 hover:text-pergaminho transition">
              sair
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
