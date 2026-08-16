import { NextRequest, NextResponse } from 'next/server';
import { alternarCupom, criarCupom, listarCupons } from '@/lib/cupons';
import { registrarEvento } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';

/**
 * Cupons, do painel. Exige sessão de admin em todos os métodos.
 *
 * Não tem DELETE de propósito: apagar um cupom deixa os pedidos que o usaram
 * apontando para um código inexistente, e some com o histórico de quanto a
 * campanha custou. Desligar resolve o mesmo problema sem perder o rastro.
 */
async function exigirAdmin() {
  const sessao = await sessaoAtual();
  return sessao && sessao.tipo === 'admin';
}

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return NextResponse.json({ cupons: listarCupons() });
}

export async function POST(req: NextRequest) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const corpo = (await req.json().catch(() => ({}))) ?? {};
  const resultado = criarCupom({
    codigo: String(corpo.codigo ?? ''),
    desconto_percentual: Number(corpo.desconto_percentual),
    usos_max:
      corpo.usos_max === null || corpo.usos_max === undefined
        ? null
        : Number(corpo.usos_max),
    nota: corpo.nota ?? null,
  });

  if (!resultado.ok) return NextResponse.json({ ok: false, erro: resultado.erro });

  registrarEvento(`cupom_criado_${resultado.codigo}`);
  return NextResponse.json({ ok: true, codigo: resultado.codigo });
}

export async function PATCH(req: NextRequest) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const { codigo, ativo } = (await req.json().catch(() => ({}))) ?? {};
  if (typeof codigo !== 'string') {
    return NextResponse.json({ erro: 'código ausente' }, { status: 400 });
  }

  alternarCupom(codigo, !!ativo);
  return NextResponse.json({ ok: true });
}
