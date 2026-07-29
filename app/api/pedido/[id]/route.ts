import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ status: pedido.status, nome: pedido.nome });
}
