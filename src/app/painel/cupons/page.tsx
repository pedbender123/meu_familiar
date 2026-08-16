import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { listarCupons } from '@/lib/cupons';
import { PainelDeCupons } from '@/components/PainelDeCupons';

export const metadata = { title: 'Cupons', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Cupons() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      <p className="font-corpo font-light text-xs text-pergaminho/45 max-w-[70ch] leading-relaxed">
        O cupom de lançamento é aplicado sozinho na tela de oferta enquanto
        estiver ativo. Desligá-lo aqui desliga a condição em todo lugar — o
        preço riscado volta a ser o de tabela, sem ninguém editar código.
      </p>
      <PainelDeCupons inicial={listarCupons()} />
    </div>
  );
}
