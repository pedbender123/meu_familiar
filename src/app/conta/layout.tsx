import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { MenuDaConta } from '@/components/MenuDaConta';

export const metadata = {
  title: 'Seu Bruxário',
  robots: { index: false, follow: false },
};

/**
 * A moldura da área logada.
 *
 * O layout guarda o acesso **uma vez só**, aqui, em vez de cada página repetir
 * a checagem — assim não existe a página nova que alguém esquece de proteger.
 *
 * Segue a regra da estética: isto é o QUARTO. A navegação é interface e fica
 * no escuro; o conteúdo de cada página é que sobe no pergaminho.
 */
export default async function LayoutDaConta({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') redirect('/entrar');

  return (
    <>
      <PoeiraNaLuz />
      <div className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center">
        <MenuDaConta email={sessao.email} />
        <main className="w-full flex-1 flex flex-col items-center px-5 pb-16">
          {children}
        </main>
      </div>
    </>
  );
}
