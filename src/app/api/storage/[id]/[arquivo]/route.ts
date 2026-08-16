import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { buscarPedido } from '@/lib/db';
import { pastaDoPedido } from '@/lib/caminhos';

const ARQUIVOS_PERMITIDOS: Record<string, string> = {
  'story.png': 'image/png',
  'feed.png': 'image/png',
  'carta.webp': 'image/webp',
  'og.png': 'image/png',
  'revelacao.pdf': 'application/pdf',
  'narracao.mp3': 'audio/mpeg',
  'veu.webp': 'image/webp',
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
  if (!pedido) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  /**
   * O véu sai antes do pagamento, e só ele.
   *
   * É a arte do familiar já destruída pelo desfoque no servidor (ver
   * `gerarVeu`): mostra que existe uma imagem, não mostra qual. Liberar o
   * arquivo NÍTIDO aqui entregaria de graça o que a leitura vende.
   *
   * `carta.webp`/`og.png` continuam liberados no set porque o card de
   * compartilhamento (pós-pagamento) precisa ser buscável por robô de rede
   * social, que não manda cookie nem segue redirecionamento — mas hoje eles só
   * existem depois de `entregue`, então esta linha é defensiva, não uma porta
   * aberta de verdade.
   */
  const LIBERADOS_ANTES = new Set(['carta.webp', 'og.png', 'veu.webp']);
  if (pedido.status !== 'entregue' && !LIBERADOS_ANTES.has(arquivo)) {
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
