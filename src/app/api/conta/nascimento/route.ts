import { NextRequest, NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { salvarDadosDeNascimento } from '@/nucleo/perfil-astral';

/**
 * Recebe os dados de nascimento que faltavam para o mapa natal.
 *
 * A validação é do servidor porque o cálculo astrológico é: coordenada fora
 * de faixa ou data impossível não viram erro visível, viram um mapa
 * silenciosamente errado — e um calendário errado é pior que nenhum.
 */
export async function POST(req: NextRequest) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') {
    return NextResponse.json({ erro: 'não autenticado' }, { status: 401 });
  }

  const conta = buscarConta(sessao.email);
  if (!conta) {
    return NextResponse.json({ erro: 'conta não encontrada' }, { status: 404 });
  }

  let corpo: {
    data?: string;
    hora?: string;
    cidade?: string;
    lat?: number;
    lon?: number;
  };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'corpo inválido' }, { status: 400 });
  }

  const { data, hora, cidade, lat, lon } = corpo;

  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ erro: 'data de nascimento inválida' }, { status: 400 });
  }
  // Data que o JS aceita mas que não existe (31/02 vira 03/03) passaria pela
  // regex acima e daria um mapa de outro dia.
  const quando = new Date(`${data}T00:00:00`);
  if (Number.isNaN(quando.getTime()) || !data.startsWith(String(quando.getFullYear()))) {
    return NextResponse.json({ erro: 'data de nascimento inválida' }, { status: 400 });
  }
  if (quando.getTime() > Date.now()) {
    return NextResponse.json({ erro: 'data no futuro' }, { status: 400 });
  }

  if (!hora || !/^\d{2}:\d{2}$/.test(hora)) {
    return NextResponse.json({ erro: 'hora inválida' }, { status: 400 });
  }
  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return NextResponse.json({ erro: 'latitude inválida' }, { status: 400 });
  }
  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return NextResponse.json({ erro: 'longitude inválida' }, { status: 400 });
  }

  salvarDadosDeNascimento(conta.id, {
    data,
    hora,
    cidade: (cidade ?? '').trim().slice(0, 120),
    lat,
    lon,
  });

  return NextResponse.json({ ok: true });
}
