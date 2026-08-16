import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { PainelDeMarcacoes } from '@/components/painel/PainelDeMarcacoes';
import { listarMarcacoes } from '@/lib/marcacoes';

export const metadata = {
  title: 'Marcações',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function Marcacoes() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  return (
    <div className="max-w-5xl">
      <PainelDeMarcacoes inicial={listarMarcacoes()} />
    </div>
  );
}
