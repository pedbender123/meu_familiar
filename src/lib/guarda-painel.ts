import { NextResponse } from 'next/server';
import { sessaoAtual } from './sessao-servidor';
import { podeEditarPainel } from './autenticacao';

/**
 * O portão único de toda rota do painel que **muda** alguma coisa.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * As sete rotas de `/api/painel` conferiam a mesma linha copiada:
 * `if (!sessao || sessao.tipo !== 'admin')`. Enquanto só o dono tinha sessão
 * de admin, isso bastava. Com a equipe (migração 021), `tipo === 'admin'`
 * passou a valer também para quem só pode LER — e as sete linhas copiadas
 * viraram sete lugares onde um leitor cria cupom, apaga campanha e dispara
 * remarketing.
 *
 * Uma função só, importada por todas: quando aparecer a oitava rota, o
 * esquecimento é visível na revisão em vez de invisível em produção.
 *
 * ── Uso ───────────────────────────────────────────────────────────────────
 *
 * ```ts
 * const barrado = await exigirEdicaoNoPainel();
 * if (barrado) return barrado;
 * ```
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

  /**
   * 403, e não 401: a diferença importa para quem está do outro lado. 401 diz
   * "entre"; quem já entrou e tentar de novo entra de novo e falha de novo.
   * 403 diz "você entrou, e mesmo assim não pode" — que é a verdade.
   */
  if (!podeEditarPainel(sessao.email)) {
    return NextResponse.json(
      { erro: 'somente leitura: este acesso não pode alterar nada' },
      { status: 403 }
    );
  }

  return null;
}

/** A sessão do painel, para quem só precisa LER. `null` = não pode ver. */
export async function sessaoDoPainel() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') return null;
  return sessao;
}
