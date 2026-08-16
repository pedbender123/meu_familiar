import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { salvarOraculoEspera } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Guarda um recado para quando o Oráculo abrir.
 *
 * **Não responde nada e não chama modelo nenhum** — é uma caixa de bilhetes.
 *
 * O e-mail vem da **sessão**, nunca do corpo do pedido. Antes ele era enviado
 * pelo cliente junto com a pergunta, o que deixava qualquer um gravar texto em
 * nome de qualquer endereço. Agora só quem está logado escreve, e só em nome
 * de si mesmo.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`oraculo:${ip}`)) {
    return NextResponse.json(
      { erro: 'Muitos envios. Aguarde um instante.' },
      { status: 429 }
    );
  }

  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'conta') {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }

  const { pergunta } = (await req.json().catch(() => ({}))) ?? {};
  if (!pergunta || typeof pergunta !== 'string' || !pergunta.trim()) {
    return NextResponse.json({ erro: 'escreva alguma coisa' }, { status: 400 });
  }

  salvarOraculoEspera(uuidv4(), sessao.email, pergunta.trim().slice(0, 500));
  return NextResponse.json({ ok: true });
}
