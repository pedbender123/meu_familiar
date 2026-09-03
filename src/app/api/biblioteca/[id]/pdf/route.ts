import { NextRequest, NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { lerEbook } from '@/nucleo/biblioteca/leitura';
import { downloadDoLivro } from '@/nucleo/biblioteca/desbloqueios';
import { gerarPdfDoLivro } from '@/lib/pdf-livro';
import { nomeDaConta } from '@/lib/acesso-plataforma';
import { DIAS_DE_CARENCIA } from '@/nucleo/carencia';

/**
 * O livro comprado, em PDF.
 *
 * ── A regra mora aqui, não no botão ───────────────────────────────────────
 *
 * A tela esconde o botão enquanto o prazo não vence, e isso é cortesia, não
 * segurança: o endereço é `/api/biblioteca/<id>/pdf`, e qualquer pessoa
 * consegue digitá-lo. Quem decide é esta rota — `downloadDoLivro` responde as
 * três perguntas de uma vez (comprou? foi compra mesmo, e não assinatura?
 * passaram os sete dias?).
 *
 * ── Gerado na hora, e não guardado ────────────────────────────────────────
 *
 * O livro muda: uma revisão de texto, um capítulo reescrito. Um PDF gravado
 * em disco no dia da compra entregaria para sempre a versão com o erro de
 * digitação que já foi corrigido. Gerar leva menos de um segundo, acontece uma
 * vez por pessoa por livro, e sempre entrega a versão de agora.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') {
    return NextResponse.json({ erro: 'entre na sua conta' }, { status: 401 });
  }

  const estado = downloadDoLivro(sessao.email, id);
  if (!estado.comprado) {
    /**
     * 404 e não 403: quem lê pela assinatura não "foi barrado", ela nunca teve
     * arquivo para baixar. E responder diferente para livro que a pessoa tem e
     * livro que ela não tem transformaria esta rota num consultor de catálogo
     * alheio.
     */
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  if (!estado.liberado) {
    return NextResponse.json(
      {
        erro: `o arquivo abre ${DIAS_DE_CARENCIA} dias depois da compra`,
        diasQueFaltam: estado.diasQueFaltam,
      },
      { status: 403 }
    );
  }

  const lido = lerEbook(id);
  if (!lido) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });

  const pdf = await gerarPdfDoLivro(
    lido.livro,
    lido.ebook.titulo,
    nomeDaConta(sessao.email)
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bruxario-${lido.ebook.id}.pdf"`,
      // Privado: o arquivo leva o nome de quem comprou na capa.
      'Cache-Control': 'private, no-store',
    },
  });
}
