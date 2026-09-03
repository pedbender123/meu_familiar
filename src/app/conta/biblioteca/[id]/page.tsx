import { notFound, redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { assinaturasAtivasDaConta } from '@/nucleo/assinaturas';
import { podeAbrir } from '@/nucleo/biblioteca/desbloqueios';
import { lerEbook } from '@/nucleo/biblioteca/leitura';
import { Leitor } from '@/components/biblioteca/Leitor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lido = lerEbook(id);
  return {
    title: lido?.ebook.titulo ?? 'Biblioteca',
    robots: { index: false, follow: false },
  };
}

/**
 * A leitura de um livro.
 *
 * ── O direito é checado no SERVIDOR, antes de renderizar ──────────────────
 *
 * Esconder o texto no cliente deixaria o livro inteiro no HTML de quem não
 * comprou — é o mesmo erro que a revelação já evita, e aqui custaria o
 * produto: quem abre o inspetor lê os três de graça.
 */
export default async function LerLivro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') redirect('/entrar');

  const lido = lerEbook(id);
  if (!lido) notFound();

  const conta = buscarConta(sessao.email);
  const assina = conta ? assinaturasAtivasDaConta(conta.id).length > 0 : false;

  if (!podeAbrir(sessao.email, id, assina)) {
    redirect('/conta/biblioteca');
  }

  return <Leitor ebookId={lido.ebook.id} titulo={lido.ebook.titulo} livro={lido.livro} />;
}
