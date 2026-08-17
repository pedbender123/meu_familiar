import { NextResponse } from 'next/server';
import { buscarCobranca } from '@/nucleo/cobrancas';

/**
 * O status da cobrança — o que o checkout consulta enquanto espera o Pix.
 *
 * Devolve o mínimo. `status` é o que a tela precisa para saber que pode
 * seguir; qualquer campo a mais aqui seria dado de cobrança exposto numa rota
 * que não pede sessão, e ela não pede de propósito: quem está com a aba
 * aberta esperando o Pix confirmar pode ter perdido a sessão no caminho, e
 * derrubar o polling por isso deixaria a pessoa olhando uma tela parada
 * depois de já ter pago.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cobranca = buscarCobranca(id);

  if (!cobranca) {
    return NextResponse.json({ erro: 'não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ status: cobranca.status });
}
