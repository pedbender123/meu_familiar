import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { salvarOraculoEspera } from '@/lib/db';
import { validarEmail } from '@/lib/validacao';

export async function POST(req: NextRequest) {
  const { email, pergunta } = (await req.json()) ?? {};
  if (!validarEmail(email) || !pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    return NextResponse.json({ erro: 'dados inválidos' }, { status: 400 });
  }
  salvarOraculoEspera(uuidv4(), email.trim(), pergunta.trim().slice(0, 500));
  return NextResponse.json({ ok: true });
}
