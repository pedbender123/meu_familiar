import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { buscarPedido } from '@/lib/db';
import { pastaDoPedido, familiarFundidaPng } from '@/lib/caminhos';

const ARQUIVOS_PERMITIDOS: Record<string, string> = {
  'story.png': 'image/png',
  'feed.png': 'image/png',
  'carta.webp': 'image/webp',
  'og.png': 'image/png',
  // A arte reduzida que ilustra o e-mail. Ver `gerarArtes`.
  'email.jpg': 'image/jpeg',
  'revelacao.pdf': 'application/pdf',
  'narracao.mp3': 'audio/mpeg',
  'veu.webp': 'image/webp',
  /**
   * A aparência do familiar, sem a leitura.
   *
   * Não é um arquivo do pedido: resolve para uma das 48 artes prontas
   * (familiar × lua) em `conteudo/fundidas`. Existe para quem fez o ritual e
   * não comprou poder ver A CARA do familiar dela — que é o que o anúncio
   * prometeu — sem receber o que a Revelação vende, que é o texto.
   *
   * Mostrar isto não custa nada: a arte já existe em disco desde antes de a
   * pessoa chegar. O que custa (a leitura por IA) nem chegou a ser gerado.
   */
  'familiar.png': 'image/png',
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
  const LIBERADOS_ANTES = new Set(['carta.webp', 'og.png', 'veu.webp', 'familiar.png']);
  if (pedido.status !== 'entregue' && !LIBERADOS_ANTES.has(arquivo)) {
    return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  }

  /**
   * `familiar.png` mora fora da pasta do pedido: é arte compartilhada, a
   * mesma para todo mundo que tirou aquele familiar naquela lua.
   */
  const caminho =
    arquivo === 'familiar.png'
      ? familiarFundidaPng(pedido.familiar, pedido.lua)
      : path.join(pastaDoPedido(id), arquivo);

  /**
   * `email.jpg` nasceu depois dos pedidos que já existem.
   *
   * Ele é gerado em `gerarArtes`, junto com o resto — mas os 78 pedidos
   * anteriores à mudança não o têm, e é justamente para eles que o e-mail de
   * acesso gratuito vai sair. Sem esta rede, a imagem do familiar viraria um
   * retângulo quebrado na caixa de entrada de quem entrou antes.
   *
   * Gera na primeira vez que alguém pede e grava no disco: da segunda em
   * diante é leitura de arquivo como qualquer outro. Sem reprocessar pedido,
   * sem migração de arquivos.
   */
  if (arquivo === 'email.jpg' && !fs.existsSync(caminho)) {
    const origem = path.join(pastaDoPedido(id), 'carta.webp');
    if (!fs.existsSync(origem)) {
      return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
    }
    try {
      const { default: sharp } = await import('sharp');
      const jpg = await sharp(fs.readFileSync(origem))
        .resize(640, null, { withoutEnlargement: true })
        .flatten({ background: '#1A1420' })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();
      fs.writeFileSync(caminho, jpg);
    } catch (erro) {
      console.error(`[storage] email.jpg falhou no pedido ${id}:`, erro);
      return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
    }
  }

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
