import { NextRequest, NextResponse } from 'next/server';
import {
  confirmarMarcacao,
  gerarLinkDeResgate,
  listarMarcacoes,
} from '@/lib/marcacoes';
import { sessaoAtual } from '@/lib/sessao-servidor';

async function admin() {
  const s = await sessaoAtual();
  return s && s.tipo === 'admin';
}

export async function GET() {
  if (!(await admin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return NextResponse.json({ marcacoes: listarMarcacoes() });
}

/** Confirma uma marcação (credita o bônus) ou gera link de resgate. */
export async function POST(req: NextRequest) {
  if (!(await admin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const { acao, id, arroba } = (await req.json().catch(() => ({}))) ?? {};

  if (acao === 'confirmar' && typeof id === 'string') {
    return NextResponse.json({ ok: confirmarMarcacao(id) });
  }

  if (acao === 'link' && typeof arroba === 'string') {
    const token = gerarLinkDeResgate(arroba);
    const base = process.env.BASE_URL || 'https://bruxario.com.br';
    return NextResponse.json({ ok: true, url: `${base}/resgatar/${token}` });
  }

  return NextResponse.json({ ok: false, erro: 'ação inválida' }, { status: 400 });
}
