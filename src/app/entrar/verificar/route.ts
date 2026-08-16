import { NextRequest, NextResponse } from 'next/server';
import {
  abrirSessao,
  consumirTokenMagico,
  ehAdmin,
  garantirConta,
  COOKIE_DA_SESSAO,
} from '@/lib/autenticacao';
import { registrarEvento } from '@/lib/db';

/**
 * Troca o link mágico por uma sessão.
 *
 * É uma **rota**, não uma página, de propósito: assim o token nunca chega a
 * ser renderizado em HTML, e a resposta já sai como um redirecionamento com o
 * cookie posto. O token some da barra de endereço no mesmo passo.
 */
/**
 * Monta o destino a partir de `BASE_URL`, **não de `req.url`**.
 *
 * Atrás do nginx, `req.url` é o endereço interno (`http://localhost:3000`).
 * Redirecionar a partir dele mandava a pessoa para um host que não existe no
 * navegador dela — ou seja, **todo login quebrava em produção** enquanto
 * funcionava perfeitamente em desenvolvimento. Pego em teste no ar.
 */
function destinoAbsoluto(caminho: string, req: NextRequest): URL {
  const base = process.env.BASE_URL?.trim();
  return new URL(caminho, base || req.url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const validado = consumirTokenMagico(token);

  if (!validado) {
    return NextResponse.redirect(destinoAbsoluto('/entrar?estado=invalido', req));
  }

  // O tipo é reconferido contra o ambiente: um token de admin emitido quando
  // o ADMIN_EMAIL era outro não pode valer agora.
  const tipo =
    validado.tipo === 'admin' && ehAdmin(validado.email) ? 'admin' : 'conta';

  if (tipo === 'conta') garantirConta(validado.email);

  const { token: sessao, expiraEm } = abrirSessao(validado.email, tipo);
  registrarEvento(tipo === 'admin' ? 'admin_entrou' : 'conta_entrou');

  /**
   * O `e=lg` viaja para o destino final.
   *
   * Sem isso o marcador morria aqui: o `Farejador` só roda na página que
   * abre, e ela é o resultado deste redirect. O toque nunca seria gravado, e
   * o retorno de quem clica no link de acesso ficaria invisível na jornada —
   * que é justamente o buraco que este rastreio existe para fechar.
   */
  const destino = (tipo === 'admin' ? '/painel' : '/conta') + '?e=lg';
  const resposta = NextResponse.redirect(destinoAbsoluto(destino, req));

  resposta.cookies.set(COOKIE_DA_SESSAO, sessao, {
    httpOnly: true, // JavaScript da página nunca lê o cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // sobrevive ao clique vindo do e-mail
    path: '/',
    expires: expiraEm,
  });

  return resposta;
}
