import { NextRequest, NextResponse } from 'next/server';
import { resgatarPorToken } from '@/lib/marcacoes';
import { validarEmail } from '@/lib/validacao';
import { excedeuLimite } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`resgatar:${ip}`)) {
    return NextResponse.json({ ok: false, erro: 'Aguarde um instante.' }, { status: 429 });
  }

  const { token, email } = (await req.json().catch(() => ({}))) ?? {};

  if (typeof token !== 'string' || !validarEmail(String(email ?? '').trim())) {
    return NextResponse.json({ ok: false, erro: 'Dados inválidos.' }, { status: 400 });
  }

  return NextResponse.json(resgatarPorToken(token, String(email).trim()));
}
