import { NextRequest, NextResponse } from 'next/server';
import { buscarPedidoHoroscopo } from '@/lib/horoscopo/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pedido = buscarPedidoHoroscopo(id);
  if (!pedido) return NextResponse.json({ erro: 'não encontrado' }, { status: 404 });
  return NextResponse.json({ status: pedido.status });
}
