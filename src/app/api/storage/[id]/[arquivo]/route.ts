import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { buscarPedido } from '@/lib/db';
import { pastaDoPedido } from '@/lib/caminhos';

const ARQUIVOS_PERMITIDOS: Record<string, string> = {
  'story.png': 'image/png',
  'feed.png': 'image/png',
  'revelacao.pdf': 'application/pdf',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; arquivo: string }> }
) {
  const { id, arquivo } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id) || !ARQUIVOS_PERMITIDOS[arquivo]) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const pedido = buscarPedido(id);
  if (!pedido || pedido.status !== 'entregue') {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const caminho = path.join(pastaDoPedido(id), arquivo);
  if (!fs.existsSync(caminho)) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  const conteudo = fs.readFileSync(caminho);
  return new NextResponse(conteudo, {
    headers: {
      'Content-Type': ARQUIVOS_PERMITIDOS[arquivo],
      'Cache-Control': 'private, max-age=31536000',
    },
  });
}
