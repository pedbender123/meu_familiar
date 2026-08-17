import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { SEM_DIREITOS } from '@/nucleo/direitos';
import { LivroAberto, type ItemDoSumario } from '@/plataforma/LivroAberto';

export const metadata = {
  title: 'Seu Bruxário',
  robots: { index: false, follow: false },
};

/**
 * A moldura da área logada — o grimório aberto (Fase 5).
 *
 * O layout guarda o acesso **uma vez só**, aqui, em vez de cada página
 * repetir a checagem — assim não existe a página nova que alguém esquece de
 * proteger.
 *
 * Os direitos são lidos aqui e viram o sumário: é o único lugar que decide o
 * que a pessoa vê listado. Capítulo sem direito continua no índice, mais
 * apagado — ver `LivroAberto`.
 */
export default async function LayoutDaConta({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') redirect('/entrar');

  const conta = buscarConta(sessao.email);
  const direitos = conta
    ? direitosEfetivos(conta.id, sessao.email)
    : SEM_DIREITOS;

  // Numeração de capítulo em romano: é o que um grimório usaria, e dá ao
  // sumário um ritmo que "1. 2. 3." não dá.
  const itens: ItemDoSumario[] = [
    { numero: 'I', rotulo: 'Início', rota: '/conta', liberado: true },
    {
      numero: 'II',
      rotulo: 'Familiar',
      rota: '/conta/familiar',
      liberado: direitos.pdf || direitos.perfilCompleto,
    },
    {
      numero: 'III',
      rotulo: 'Oráculo',
      rota: '/conta/oraculo',
      liberado: direitos.perguntasOraculo > 0,
    },
    {
      numero: 'IV',
      rotulo: 'Calendário',
      rota: '/conta/calendario',
      liberado: direitos.alcanceCalendario !== 'nenhum' || direitos.tiragemDiaria,
    },
  ];

  return (
    <LivroAberto itens={itens} email={sessao.email}>
      {children}
    </LivroAberto>
  );
}
