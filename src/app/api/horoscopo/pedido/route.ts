import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { calcularSignos } from '@/lib/astro';
import { criarPedidoHoroscopo } from '@/lib/horoscopo/db';

export async function POST(req: NextRequest) {
  try {
    const { nome, data_nascimento } = await req.json();

    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      return NextResponse.json({ erro: 'nome obrigatório' }, { status: 400 });
    }
    if (!data_nascimento || !/^\d{4}-\d{2}-\d{2}$/.test(data_nascimento)) {
      return NextResponse.json({ erro: 'data de nascimento inválida' }, { status: 400 });
    }

    const { signoSol, signoLua } = calcularSignos(data_nascimento);
    const id = randomUUID();

    criarPedidoHoroscopo({
      id,
      nome: nome.trim().slice(0, 120),
      data_nascimento,
      signo_sol: signoSol,
      signo_lua: signoLua,
    });

    return NextResponse.json({ id });
  } catch (erro) {
    console.error('[api/horoscopo/pedido] erro:', erro);
    return NextResponse.json({ erro: 'falha interna' }, { status: 500 });
  }
}
