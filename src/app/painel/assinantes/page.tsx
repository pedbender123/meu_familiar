import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { resumoDeAssinantes, assinantesAtivos } from '@/nucleo/assinantes';
import { PainelDeAssinantes } from '@/components/painel/Assinantes';

export const metadata = { title: 'Assinantes', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * O painel do negócio de assinatura.
 *
 * O resto do painel foi construído para o mundo de pedidos avulsos: ele conta
 * vendas que aconteceram uma vez. Esta tela responde a outra pergunta —
 * quanto entra todo mês se ninguém mexer em nada, e quem está prestes a
 * deixar de entrar.
 */
export default async function Assinantes() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  return (
    <PainelDeAssinantes
      resumo={resumoDeAssinantes()}
      lista={assinantesAtivos()}
    />
  );
}
