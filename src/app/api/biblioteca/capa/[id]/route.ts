import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { buscarEbook, caminhoDaCapa } from '@/nucleo/biblioteca/catalogo';

/**
 * A capa de um livro.
 *
 * ── Aberta de propósito ───────────────────────────────────────────────────
 *
 * A capa é vitrine: ela aparece no checkout para quem ainda não comprou e na
 * estante para quem não desbloqueou. Trancá-la atrás do direito de leitura
 * esconderia a oferta de exatamente quem precisa vê-la.
 *
 * O que é trancado é o TEXTO, que é o produto. A capa é o convite.
 *
 * ── O id vem do catálogo, nunca do caminho ────────────────────────────────
 *
 * `buscarEbook` resolve o id contra a lista fixa e é dele que sai o nome do
 * arquivo. Sem isso, `/api/biblioteca/capa/..%2F..%2F.env` seria um leitor de
 * arquivo arbitrário — o caminho nunca é montado com texto do navegador.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ebook = buscarEbook(id);
  if (!ebook) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const caminho = caminhoDaCapa(ebook);
  if (!fs.existsSync(caminho)) {
    // Capa é enfeite: o livro sem ela continua vendendo, só aparece sem
    // imagem. A tela trata o 404 desenhando a lombada.
    return NextResponse.json({ erro: 'sem capa' }, { status: 404 });
  }

  const tipo = caminho.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return new NextResponse(new Uint8Array(fs.readFileSync(caminho)), {
    headers: {
      'Content-Type': tipo,
      // A capa só muda quando alguém publica outra. Um dia de cache tira ela
      // do caminho crítico do checkout sem prender uma versão errada por
      // semanas.
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
