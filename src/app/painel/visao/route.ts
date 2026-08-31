import { NextRequest, NextResponse } from 'next/server';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { COOKIE_DA_VISAO, areaVisivel, ehVisao } from '@/lib/visao-do-painel';

/**
 * Troca o recorte do painel e volta para onde a pessoa estava.
 *
 * ── Por que uma rota, e não um botão com JavaScript ───────────────────────
 *
 * O menu é montado no servidor a partir do cookie. Um botão que escrevesse o
 * cookie no navegador precisaria depois forçar um recarregamento para o menu
 * mudar — dois passos, e um intervalo em que a tela mostra um menu que já não
 * corresponde à escolha. Um link que grava e redireciona faz as duas coisas
 * numa viagem só.
 *
 * ── Por que exige sessão ──────────────────────────────────────────────────
 *
 * O cookie não dá acesso a nada, mas gravá-lo em quem nem entrou no painel
 * seria deixar qualquer visitante do site carregar estado nosso à toa.
 */
export async function GET(req: NextRequest) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') {
    return NextResponse.redirect(new URL('/painel/entrar', req.url));
  }

  const para = req.nextUrl.searchParams.get('para');
  const voltar = req.nextUrl.searchParams.get('voltar');

  /*
    O destino sai de uma lista fechada de caminhos internos. Redirecionar para
    o que vier na query seria um redirecionamento aberto: bastaria mandar o
    link `?voltar=https://outro-site` para alguém sair daqui achando que
    continua aqui.
  */
  const interno =
    typeof voltar === 'string' && voltar.startsWith('/painel/') && !voltar.startsWith('//');

  /*
    E a tela onde a pessoa estava tem que existir no recorte novo. Voltar para
    /painel/pedidos depois de entrar na visão de vendedor deixaria alguém numa
    página que o próprio menu diz não existir — a pior forma de estrear um
    modo novo.
  */
  const destino =
    interno && ehVisao(para) && areaVisivel(voltar!, para) ? voltar! : '/painel/central';

  const resposta = NextResponse.redirect(new URL(destino, req.url));
  if (ehVisao(para)) {
    resposta.cookies.set(COOKIE_DA_VISAO, para, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return resposta;
}
