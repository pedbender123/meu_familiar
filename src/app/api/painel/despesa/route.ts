import { NextRequest, NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { apagarDespesa, criarDespesa } from '@/lib/financeiro';
import { ehCategoria } from '@/lib/financeiro-tipos';
import { deLocalParaUtc } from '@/lib/periodo';

async function exigirAdmin() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const d = (await req.json().catch(() => ({}))) ?? {};
  const descricao = String(d.descricao ?? '').trim().slice(0, 120);
  if (!descricao) {
    return NextResponse.json({ erro: 'Descreva o gasto.' }, { status: 400 });
  }

  const valor = Number(String(d.valor ?? '').replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: 'Valor inválido.' }, { status: 400 });
  }

  // A data vem como `date` (só o dia) ou `datetime-local`. Meia-noite de
  // Brasília é o padrão razoável para "gastei nesse dia".
  const bruta = String(d.ocorrido_em ?? '');
  const ocorrido =
    deLocalParaUtc(bruta.length === 10 ? `${bruta}T00:00` : bruta) ??
    new Date().toISOString();

  const id = criarDespesa({
    descricao,
    categoria: ehCategoria(d.categoria) ? d.categoria : 'outro',
    valor_centavos: Math.round(valor * 100),
    campanha_id: typeof d.campanha_id === 'string' && d.campanha_id ? d.campanha_id : null,
    ocorrido_em: ocorrido,
    nota: String(d.nota ?? '').trim().slice(0, 300) || null,
  });

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const barrado = await exigirAdmin();
  if (barrado) return barrado;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ erro: 'id ausente' }, { status: 400 });

  apagarDespesa(id);
  return NextResponse.json({ ok: true });
}
