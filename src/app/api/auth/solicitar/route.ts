import { NextRequest, NextResponse } from 'next/server';
import {
  buscarConta,
  criarTokenMagico,
  emailDoAdmin,
  VALIDADE_DO_LINK_MIN,
} from '@/lib/autenticacao';
import { enviarLinkMagico } from '@/lib/email';
import { validarEmail } from '@/lib/validacao';
import { excedeuLimite } from '@/lib/rate-limit';

/**
 * Pede um link mágico.
 *
 * ── A resposta é sempre a mesma ───────────────────────────────────────────
 *
 * Existindo ou não a conta, a resposta é `{ ok: true }`. Se ela variasse, esta
 * rota viraria uma consulta pública de "esse e-mail é cliente do Bruxário?" —
 * e o produto lida com intimidade, então isso não é detalhe.
 *
 * ── O painel não aceita e-mail de fora ────────────────────────────────────
 *
 * Para `tipo: 'admin'` o endereço **não vem do pedido**: vem de `ADMIN_EMAIL`
 * no ambiente. Mandar outro e-mail no corpo não muda nada. É o que garante
 * que a tela do painel não tenha superfície de ataque nenhuma — não há para
 * onde apontar o link.
 *
 * ── As duas portas são independentes ──────────────────────────────────────
 *
 * O que decide o tipo do link é **por onde a pessoa pediu**, nunca quem ela é.
 * O dono do painel também é cliente: ele faz o ritual, tem revelação e conta
 * como qualquer um. Antes, `ehAdmin(email)` no caminho da conta sequestrava o
 * login normal dele e o jogava no painel — o endereço fixo é a chave de uma
 * porta, não um carimbo na pessoa.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  // Limite curto de propósito: sem ele, qualquer um enche a caixa de entrada
  // de alguém pedindo link atrás de link.
  if (excedeuLimite(`auth:${ip}`)) {
    return NextResponse.json(
      { erro: 'Muitos pedidos. Aguarde um instante.' },
      { status: 429 }
    );
  }

  let corpo: { email?: string; tipo?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: 'pedido inválido' }, { status: 400 });
  }

  const tipo = corpo.tipo === 'admin' ? 'admin' : 'conta';

  if (tipo === 'admin') {
    const destino = emailDoAdmin();
    if (!destino) {
      console.warn('[auth] ADMIN_EMAIL não configurado — painel inacessível');
      return NextResponse.json({ ok: true });
    }
    await mandar(destino, 'admin', req);
    return NextResponse.json({ ok: true });
  }

  const email = corpo.email?.trim().toLowerCase() ?? '';
  if (!validarEmail(email)) {
    return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
  }

  // Sempre tipo 'conta': quem quer o painel pede pela porta do painel.
  // Só manda se a conta existir — mas responde igual de qualquer forma.
  if (buscarConta(email)) {
    await mandar(email, 'conta', req);
  }

  return NextResponse.json({ ok: true });
}

async function mandar(email: string, tipo: 'conta' | 'admin', req: NextRequest) {
  const token = criarTokenMagico(email, tipo);
  const base = process.env.BASE_URL || req.nextUrl.origin;
  // `lg`: retorno de quem já é cliente, NÃO conta como aquisição.
  const url = `${base}/entrar/verificar?t=${encodeURIComponent(token)}&e=lg`;

  try {
    await enviarLinkMagico({ email, url, minutosDeValidade: VALIDADE_DO_LINK_MIN });
  } catch (erro) {
    // Falha de envio não vira erro pro cliente: a resposta precisa ser
    // indistinguível. Fica no log, que é onde se investiga.
    console.error('[auth] falha ao enviar link mágico:', erro);
  }
}
