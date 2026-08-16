import { NextRequest, NextResponse } from 'next/server';
import { salvarRascunho } from '@/lib/db';
import { normalizarOrigem } from '@/lib/analitica';
import { validarEmail } from '@/lib/validacao';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';

/**
 * Guarda o e-mail deixado no meio do ritual.
 *
 * ── Por que pedir o e-mail antes do fim ───────────────────────────────────
 *
 * Quem larga na cena 12 hoje some sem deixar nada. Com o e-mail, dá para
 * mandar **um** lembrete com o link de onde parou — e essa é, de longe, a
 * recuperação mais barata que existe num funil de anúncio pago.
 *
 * ── O limite que isto se impõe ────────────────────────────────────────────
 *
 * O e-mail é pedido com uma justificativa verdadeira ("guardar o progresso e
 * mandar o resultado") e é isso que ele faz. Não vira lista de propaganda, não
 * é vendido, e o lembrete sai **uma vez só** — `lembrete_em` no banco existe
 * justamente para tornar o segundo envio impossível, não só improvável.
 *
 * Se um dia isto virar newsletter, a base legal muda de execução de contrato
 * para consentimento, e aí precisa de caixa marcada pela pessoa. Enquanto for
 * só o lembrete do que ela começou, não precisa.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'local';
  if (excedeuLimite(`progresso:${ip}`, LIMITES.analitica)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const visitante = req.cookies.get('bx_v')?.value;
  if (!visitante || !/^[a-f0-9-]{36}$/.test(visitante)) {
    // Sem cookie não há a quem associar. Não é erro para a pessoa: ela segue
    // o ritual normalmente e dá o e-mail de novo no fim.
    return NextResponse.json({ ok: true });
  }

  let corpo: { email?: string; cena?: number };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email = String(corpo.email ?? '').trim();
  if (!validarEmail(email)) {
    return NextResponse.json({ ok: false, erro: 'E-mail inválido.' });
  }

  const cena = Number(corpo.cena);

  try {
    salvarRascunho({
      visitante,
      email,
      cena: Number.isInteger(cena) && cena >= 0 && cena <= 99 ? cena : 0,
      origem: normalizarOrigem(req.cookies.get('bx_de')?.value),
    });
  } catch (erro) {
    console.error('[api/progresso]', erro);
  }

  return NextResponse.json({ ok: true });
}
