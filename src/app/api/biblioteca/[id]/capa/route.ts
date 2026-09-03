import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { buscarEbook, caminhoDaCapa } from '@/nucleo/biblioteca/catalogo';

/**
 * A capa de um ebook.
 *
 * ── Por que uma rota, e não `/public` ─────────────────────────────────────
 *
 * Porque os arquivos são largados à mão em `biblioteca/capas/`, e `public/` é
 * servido estaticamente a partir do build — um arquivo posto lá depois do
 * build não existe até o próximo deploy. A promessa do `LEIA-ME.md` é que o
 * livro aparece sozinho ao largar o arquivo, e isso só vale se a leitura for
 * em runtime.
 *
 * ── Capa é pública, PDF não ───────────────────────────────────────────────
 *
 * A capa é vitrine: ela aparece no checkout para quem ainda não comprou, e
 * esconder o que está à venda seria esconder a venda. O PDF é o produto, e
 * tem rota própria, com verificação de direito.
 */

const TIPOS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ebook = buscarEbook(id);
  if (!ebook) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });

  const caminho = caminhoDaCapa(ebook);
  const tipo = TIPOS[path.extname(caminho).toLowerCase()];
  if (!tipo || !fs.existsSync(caminho)) {
    // Capa ausente não é erro: o livro vende sem imagem, e a tela já trata.
    return NextResponse.json({ erro: 'sem capa' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fs.readFileSync(caminho)), {
    headers: {
      'Content-Type': tipo,
      // Longo: a capa de um livro não muda. Trocar o arquivo pede outro nome.
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
