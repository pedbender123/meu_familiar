import { NextRequest, NextResponse } from 'next/server';
import {
  confirmarMarcacao,
  gerarLinkDeResgate,
  listarMarcacoes,
} from '@/lib/marcacoes';
import { exigirEdicaoNoPainel, sessaoDoPainel } from '@/lib/guarda-painel';

/** Ler: dono ou equipe. Alterar tem portão próprio — ver o POST. */
async function admin() {
  return !!(await sessaoDoPainel());
}

export async function GET() {
  if (!(await admin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return NextResponse.json({ marcacoes: listarMarcacoes() });
}

/** Confirma uma marcação (credita o bônus) ou gera link de resgate. */
export async function POST(req: NextRequest) {
  /**
   * Só o dono altera. A equipe vê a lista pelo GET acima, mas criar, desligar
   * ou creditar é exclusivo — ver `lib/guarda-painel.ts`.
   */
  const barrado = await exigirEdicaoNoPainel();
  if (barrado) return barrado;

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
