import { NextRequest, NextResponse } from 'next/server';
import {
  abrirSessao,
  consumirTokenMagico,
  podeVerPainel,
  garantirConta,
  COOKIE_DA_SESSAO,
} from '@/lib/autenticacao';
import { registrarEvento } from '@/lib/db';
import { destinoAbsoluto } from '@/lib/destino-absoluto';

/**
 * Troca o link mágico por uma sessão.
 *
 * É uma **rota**, não uma página, de propósito: assim o token nunca chega a
 * ser renderizado em HTML, e a resposta já sai como um redirecionamento com o
 * cookie posto. O token some da barra de endereço no mesmo passo.
 */

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const validado = consumirTokenMagico(token);

  if (!validado) {
    return NextResponse.redirect(destinoAbsoluto('/entrar?estado=invalido', req));
  }

  /**
   * O tipo é reconferido contra o ambiente: um token de admin emitido quando
   * o `ADMIN_EMAIL` era outro não pode valer agora.
   *
   * ── Por que `podeVerPainel` e não `ehAdmin` ───────────────────────────
   *
   * `ehAdmin` é só o `ADMIN_EMAIL`. `podeVerPainel` é o dono **ou** quem está
   * em `painel_acessos` — a equipe. E é `podeVerPainel` que decide se o link
   * de painel é enviado (`/api/auth/solicitar`) e se a sessão de admin vale
   * (`autenticacao.ts`, `sessaoAtual`).
   *
   * Este ponto usava a regra estreita, e era o único dos três. O efeito: quem
   * está na equipe recebia o link do painel, clicava, e era **rebaixado a
   * cliente** — `garantirConta` abria uma conta comum e o redirect mandava
   * para `/conta`. Dali, com um pedido parado em `aguardando_pagamento`, a
   * área da conta só sabe oferecer a compra: o link de acesso do time
   * terminava numa tela de pagamento.
   *
   * Rebaixar não abre poder nenhum a mais: quem só lê continua só lendo,
   * porque quem separa ver de mexer é `podeEditarPainel`, e essa continua
   * sendo exclusiva do dono.
   */
  const tipo =
    validado.tipo === 'admin' && podeVerPainel(validado.email) ? 'admin' : 'conta';

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
