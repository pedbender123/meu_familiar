import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { resumoDeAssinantes, assinantesAtivos } from '@/nucleo/assinantes';
import { usoDasContas, resumoDeUso } from '@/nucleo/uso-do-assinante';
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

  const lista = assinantesAtivos();

  /**
   * O que acontece depois da compra, buscado em lote.
   *
   * Sem isto a tela respondia só "quanto entra por mês" — e receita recorrente
   * sem uso é uma projeção de dinheiro que já parou de vir e ainda não avisou.
   */
  const usos = usoDasContas(lista.map((a) => a.conta_id));

  return (
    <PainelDeAssinantes
      resumo={resumoDeAssinantes()}
      lista={lista}
      usos={Object.fromEntries(usos)}
      uso={resumoDeUso([...usos.values()])}
    />
  );
}
