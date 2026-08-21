import { NextRequest, NextResponse } from 'next/server';
import { fecharSessao, COOKIE_DA_SESSAO } from '@/lib/autenticacao';

/**
 * Sair apaga a sessão **no banco**, não só o cookie.
 *
 * Limpar só o cookie deixaria o token válido para quem o tivesse copiado —
 * "sair" precisa invalidar de verdade.
 */
export async function POST(req: NextRequest) {
  fecharSessao(req.cookies.get(COOKIE_DA_SESSAO)?.value);
  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set(COOKIE_DA_SESSAO, '', { path: '/', maxAge: 0 });
  return resposta;
}
