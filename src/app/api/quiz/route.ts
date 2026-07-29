import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { calcularFamiliar, calcularLua, SIGNO_ELEMENTO, QUIZ } from '@/lib/familiares';
import { calcularSignos } from '@/lib/astro';
import { criarPedido } from '@/lib/db';
import { validarEmail, validarNome } from '@/lib/validacao';
import { excedeuLimite } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(ip)) {
    return NextResponse.json({ erro: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 });
  }

  const corpo = await req.json();
  const { respostas, nome, email, dataNascimento, horaNascimento } = corpo ?? {};

  if (!respostas || typeof respostas !== 'object') {
    return NextResponse.json({ erro: 'Respostas do ritual ausentes.' }, { status: 400 });
  }
  for (const pergunta of QUIZ) {
    if (!respostas[pergunta.numero]) {
      return NextResponse.json({ erro: `Pergunta ${pergunta.numero} não respondida.` }, { status: 400 });
    }
  }
  if (!validarNome(nome)) {
    return NextResponse.json({ erro: 'Nome inválido.' }, { status: 400 });
  }
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    return NextResponse.json({ erro: 'Data de nascimento inválida.' }, { status: 400 });
  }

  const { signoSol } = calcularSignos(dataNascimento, horaNascimento);
  const elementoSolar = SIGNO_ELEMENTO[signoSol];
  const familiar = calcularFamiliar(respostas, elementoSolar);
  const lua = calcularLua(respostas[8]);

  const pedidoId = uuidv4();
  criarPedido({
    id: pedidoId,
    nome: nome.trim().slice(0, 40),
    email: email.trim(),
    respostas_json: JSON.stringify({ quiz: respostas, dataNascimento, horaNascimento }),
    familiar,
    lua,
    signo_sol: signoSol,
    signo_lua: '',
  });

  return NextResponse.json({ id: pedidoId });
}
