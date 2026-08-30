import { NextRequest, NextResponse } from 'next/server';
import { exigirEdicaoNoPainel } from '@/lib/guarda-painel';
import { apagarPeca, criarPeca, listarPecas, renomearPeca } from '@/lib/campanhas';

/**
 * As peças de uma campanha — os vídeos e criativos que rodam sob o mesmo
 * anúncio. **Só admin.**
 *
 * Criar devolve o `codigo` porque é ele que você vai colar na plataforma de
 * anúncio; sem devolvê-lo, a tela teria que recarregar a lista inteira só
 * para descobrir o que acabou de criar.
 */
async function exigirAdmin() {
  /**
   * Só o dono altera. A equipe do painel entra com `tipo === 'admin'` e vê
   * tudo, mas não muda nada — ver `lib/guarda-painel.ts`.
   */
  const barrado = await exigirEdicaoNoPainel();
  if (barrado) return barrado;
  return null;
}

export async function GET(req: NextRequest) {
  const negado = await exigirAdmin();
  if (negado) return negado;

  const campanhaId = req.nextUrl.searchParams.get('campanha');
  if (!campanhaId) {
    return NextResponse.json({ erro: 'campanha ausente' }, { status: 400 });
  }
  return NextResponse.json({ pecas: listarPecas(campanhaId) });
}

export async function POST(req: NextRequest) {
  const negado = await exigirAdmin();
  if (negado) return negado;

  const corpo = await req.json().catch(() => ({}));
  const campanhaId = String(corpo?.campanha_id ?? '').trim();
  const nome = String(corpo?.nome ?? '').trim().slice(0, 80);

  if (!campanhaId) {
    return NextResponse.json({ erro: 'campanha ausente' }, { status: 400 });
  }
  // O nome é o que você vai ler no relatório daqui a um mês. "vídeo 1" não
  // diz nada; "gata preta olhando pra câmera" diz.
  if (nome.length < 3) {
    return NextResponse.json(
      { erro: 'Dê um nome que você reconheça depois — pelo menos 3 letras.' },
      { status: 400 }
    );
  }

  const r = criarPeca({
    campanha_id: campanhaId,
    nome,
    nota: corpo?.nota ? String(corpo.nota).slice(0, 240) : null,
  });
  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json(r);
}

/**
 * Renomear. Só o nome — o `codigo` e o `utm_conteudo` são chaves, e trocá-las
 * desligaria a peça do anúncio que a criou e do tráfego já atribuído a ela.
 *
 * Ganhou importância quando as peças passaram a nascer do `utm_content`: elas
 * chegam chamadas pelo ID numérico do anúncio, e sem isto aqui o painel de
 * criativos seria uma lista de dezessete dígitos.
 */
export async function PATCH(req: NextRequest) {
  const negado = await exigirAdmin();
  if (negado) return negado;

  const corpo = await req.json().catch(() => ({}));
  const id = String(corpo?.id ?? '').trim();
  const nome = String(corpo?.nome ?? '').trim().slice(0, 80);

  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });
  if (nome.length < 3) {
    return NextResponse.json(
      { erro: 'Dê um nome que você reconheça depois — pelo menos 3 letras.' },
      { status: 400 }
    );
  }

  renomearPeca(id, nome);
  return NextResponse.json({ ok: true, nome });
}

export async function DELETE(req: NextRequest) {
  const negado = await exigirAdmin();
  if (negado) return negado;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });

  /**
   * A peça some da lista, mas os toques e pedidos que apontam para ela
   * continuam — eles guardam o id, sem chave estrangeira em cascata. É
   * deliberado: apagar um vídeo do painel não pode apagar a história das
   * vendas que ele trouxe.
   */
  apagarPeca(id);
  return NextResponse.json({ ok: true });
}
