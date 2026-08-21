import { NextRequest, NextResponse } from 'next/server';
import { ehMarco, normalizarOrigem, registrarMarco } from '@/lib/analitica';

/**
 * Grava um passo da jornada.
 *
 * ── Por que uma rota separada da de visita ────────────────────────────────
 *
 * Visita é "abriu uma página"; marco é "fez alguma coisa dentro dela". Uma
 * pessoa gera 3 visitas e 30 marcos numa sessão — juntar os dois na mesma
 * tabela transformaria a contagem de visitantes numa contagem de cliques.
 *
 * ── Nada aqui vem sem validação ───────────────────────────────────────────
 *
 * O nome do marco tem que estar na lista fechada, o valor tem que ser inteiro
 * pequeno e o visitante sai do **cookie**, não do corpo. Fosse do corpo, dava
 * para inventar mil visitantes e envenenar todo o funil com um `curl`.
 */
export async function POST(req: NextRequest) {
  const visitante = req.cookies.get('bx_v')?.value;
  if (!visitante || !/^[a-f0-9-]{36}$/.test(visitante)) {
    // Sem cookie não há a quem atribuir. Devolve ok para não fazer o cliente
    // tentar de novo: é telemetria, não pedido.
    return NextResponse.json({ ok: true });
  }

  let corpo: { marco?: string; valor?: number };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!ehMarco(corpo.marco)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const bruto = Number(corpo.valor);
  const valor =
    Number.isInteger(bruto) && bruto >= 0 && bruto <= 999 ? bruto : null;

  try {
    registrarMarco({
      visitante,
      marco: corpo.marco,
      valor,
      origem: normalizarOrigem(req.cookies.get('bx_de')?.value),
    });
  } catch (erro) {
    // Telemetria nunca derruba o site.
    console.error('[api/marco]', erro);
  }

  return NextResponse.json({ ok: true });
}
