import { NextRequest, NextResponse } from 'next/server';
import { criarTokenMagico, ehAdmin, VALIDADE_DO_LINK_MIN } from '@/lib/autenticacao';
import { enviarLinkMagico } from '@/lib/email';
import { validarEmail } from '@/lib/validacao';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * O link de acesso ao painel. **Só o painel** — não há conta de cliente aqui.
 *
 * ── A resposta é sempre a mesma ───────────────────────────────────────────
 *
 * Endereço certo ou errado, a resposta é `{ ok: true }`. Se ela variasse,
 * esta rota viraria uma forma de descobrir qual e-mail administra a loja —
 * e aí bastaria comprometer aquela caixa de entrada.
 *
 * O link só sai de verdade para `ADMIN_EMAIL`. Não há cadastro, não há senha,
 * e não há quem enumerar: quem não recebe e-mail nesse endereço não entra, e
 * nenhuma tentativa daqui muda isso.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  // Sem isto, qualquer um enche a caixa de entrada do administrador pedindo
  // link atrás de link.
  if (excedeuLimite(`auth:${ip}`)) {
    return NextResponse.json({ erro: 'Muitos pedidos. Aguarde um instante.' }, { status: 429 });
  }

  let corpo: { email?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'pedido inválido' }, { status: 400 });
  }

  const email = corpo.email?.trim().toLowerCase() ?? '';
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }

  if (ehAdmin(email)) {
    try {
      const token = criarTokenMagico(email, 'admin');
      const base = process.env.BASE_URL || req.nextUrl.origin;
      await enviarLinkMagico({
        email,
        url: `${base}/entrar/verificar?t=${encodeURIComponent(token)}`,
        minutosDeValidade: VALIDADE_DO_LINK_MIN,
      });
    } catch (erro) {
      // Falha de envio não vira erro para quem pediu: a resposta precisa ser
      // indistinguível. Fica no log, que é onde se investiga.
      console.error('[auth] falha ao enviar link do painel:', erro);
    }
  }

  return NextResponse.json({ ok: true });
}
