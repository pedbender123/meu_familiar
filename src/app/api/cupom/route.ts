import { NextRequest, NextResponse } from 'next/server';
import {
  RECUSA_EM_PORTUGUES,
  precoComDesconto,
  validarCupom,
} from '@/lib/cupons';
import { PRODUTO_PADRAO, ehProdutoValido, produtoDe } from '@/lib/produtos';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Confere um cupom e devolve o preço que ele deixa.
 *
 * Só para a TELA saber o que mostrar. O valor cobrado nunca vem daqui — é
 * recalculado no servidor a partir do que ficou gravado no pedido, na hora de
 * criar o pagamento. Esta rota poderia mentir à vontade sem afetar a cobrança.
 *
 * Tem limite de taxa porque, sem ele, é um oráculo de força bruta: dá para
 * varrer códigos até achar um de 100%. O limite não impede um atacante
 * determinado, mas transforma "roda um script por um minuto" em "roda por
 * semanas", que já basta para cupons de divulgação.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`cupom:${ip}`)) {
    return NextResponse.json(
      { ok: false, erro: 'Muitas tentativas. Aguarde um instante.' },
      { status: 429 }
    );
  }

  let codigo = '';
  let produtoId = PRODUTO_PADRAO;
  try {
    const corpo = await req.json();
    codigo = String(corpo?.codigo ?? '');
    if (ehProdutoValido(corpo?.produto)) produtoId = corpo.produto;
  } catch {
    return NextResponse.json({ ok: false, erro: 'pedido inválido' }, { status: 400 });
  }

  const resultado = validarCupom(codigo);
  if (!resultado.ok) {
    return NextResponse.json({
      ok: false,
      erro: RECUSA_EM_PORTUGUES[resultado.motivo],
    });
  }

  const produto = produtoDe(produtoId);
  const preco = precoComDesconto(produto, resultado.cupom.desconto_percentual);

  return NextResponse.json({
    ok: true,
    codigo: resultado.cupom.codigo,
    descontoPercentual: preco.descontoPercentual,
    cheioCentavos: preco.cheioCentavos,
    finalCentavos: preco.finalCentavos,
    gratis: preco.gratis,
  });
}
