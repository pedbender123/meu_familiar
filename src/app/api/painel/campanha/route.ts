import { NextRequest, NextResponse } from 'next/server';
import { exigirEdicaoNoPainel } from '@/lib/guarda-painel';
import {
  apagarCampanha,
  atualizarCampanha,
  criarCampanha,
} from '@/lib/campanhas';
import { deLocalParaUtc } from '@/lib/periodo';
import { ehFunil } from '@/lib/funis';

/**
 * CRUD das campanhas. **Só admin, sempre.**
 *
 * Diferente do resto do painel (que é leitura), aqui se escreve — então a
 * sessão é conferida em toda operação, e não só no render da página. Uma tela
 * protegida com uma rota aberta é o mesmo que rota aberta.
 *
 * As datas chegam do `datetime-local` do navegador, sem fuso, e são
 * interpretadas como horário de Brasília antes de virar ISO UTC (ver
 * `periodo.ts`). Guardar o texto cru faria o relatório errar por três horas.
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

function centavos(valor: unknown): number {
  const n = Number(String(valor ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export async function POST(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const c = (await req.json().catch(() => ({}))) ?? {};
  const nome = String(c.nome ?? '').trim().slice(0, 80);
  const inicio = deLocalParaUtc(String(c.inicio ?? ''));

  if (!nome) return NextResponse.json({ erro: 'Dê um nome à campanha.' }, { status: 400 });
  if (!inicio) return NextResponse.json({ erro: 'Início inválido.' }, { status: 400 });

  const fim = c.fim ? deLocalParaUtc(String(c.fim)) : null;
  if (fim && fim <= inicio) {
    return NextResponse.json({ erro: 'O fim precisa ser depois do início.' }, { status: 400 });
  }

  /**
   * As páginas de venda desta campanha.
   *
   * Validadas contra o registro em vez de aceitas cruas — um id inventado
   * aqui viraria uma campanha que serve tela em branco para o tráfego pago.
   * Lista vazia cai no padrão, que é o comportamento de toda campanha antiga.
   */
  const funis = Array.isArray(c.funis) ? c.funis.filter(ehFunil) : [];

  const alcance = Number(c.alcance_estimado);
  const id = criarCampanha({
    nome,
    funis: funis.length > 0 ? JSON.stringify(funis) : null,
    plataforma: String(c.plataforma ?? '').trim().slice(0, 40) || null,
    inicio,
    fim,
    investido_centavos: centavos(c.investido),
    alcance_estimado: Number.isFinite(alcance) && alcance > 0 ? Math.round(alcance) : null,
    nota: String(c.nota ?? '').trim().slice(0, 500) || null,
  });

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const c = (await req.json().catch(() => ({}))) ?? {};
  const id = String(c.id ?? '');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });

  const campos: Record<string, unknown> = {};
  if (Array.isArray(c.funis)) {
    const validos = c.funis.filter(ehFunil);
    campos.funis = validos.length > 0 ? JSON.stringify(validos) : null;
  }
  if (typeof c.nome === 'string') campos.nome = c.nome.trim().slice(0, 80);
  if (typeof c.plataforma === 'string')
    campos.plataforma = c.plataforma.trim().slice(0, 40) || null;
  if (typeof c.nota === 'string') campos.nota = c.nota.trim().slice(0, 500) || null;
  if (c.investido !== undefined) campos.investido_centavos = centavos(c.investido);
  if (typeof c.inicio === 'string') {
    const i = deLocalParaUtc(c.inicio);
    if (i) campos.inicio = i;
  }
  // String vazia é intencional: significa "reabrir a campanha", tirando o fim.
  if (typeof c.fim === 'string') campos.fim = c.fim ? deLocalParaUtc(c.fim) : null;

  atualizarCampanha(id, campos);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });

  apagarCampanha(id);
  return NextResponse.json({ ok: true });
}
