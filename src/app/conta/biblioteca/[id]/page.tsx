import { notFound, redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { assinaturaPagaAtiva } from '@/nucleo/assinaturas';
import { downloadDoLivro, podeAbrir } from '@/nucleo/biblioteca/desbloqueios';
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
  // Paga, não só ativa: o plano gratuito nasce com a conta e faria a
  // estante inteira abrir para quem nunca comprou nada. Ver `assinaturaPagaAtiva`.
  const assina = conta ? assinaturaPagaAtiva(conta.id) : false;

  if (!podeAbrir(sessao.email, id, assina)) {
    redirect('/conta/biblioteca');
  }

  return (
    <Leitor
      ebookId={lido.ebook.id}
      titulo={lido.ebook.titulo}
      livro={lido.livro}
      /*
        Quem lê pela assinatura recebe `comprado: false` e não vê arquivo
        nenhum — a assinatura vende leitura, a compra vende o livro.
      */
      download={downloadDoLivro(sessao.email, id)}
    />
  );
}
