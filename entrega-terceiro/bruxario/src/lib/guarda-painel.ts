import { NextResponse } from 'next/server';
import { sessaoAtual } from './sessao-servidor';

/**
 * O portão único de toda rota do painel.
 *
 * As rotas conferiam a mesma linha copiada. Uma função só: quando aparecer a
 * próxima rota, o esquecimento é visível na revisão em vez de invisível em
 * produção.
 *
 * Devolve `null` quando pode seguir, ou a resposta pronta de recusa. Não
 * lança: rota de API que lança vira 500, e 500 num "não pode" esconde o
 * motivo de quem está depurando.
 */
export async function exigirEdicaoNoPainel(): Promise<NextResponse | null> {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return null;
}

/** A sessão do painel, para quem só precisa LER. `null` = não pode ver. */
export async function sessaoDoPainel() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') return null;
  return sessao;
}
