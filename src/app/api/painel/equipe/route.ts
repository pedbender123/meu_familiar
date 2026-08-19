import { NextRequest, NextResponse } from 'next/server';
import {
  listarAcessosDoPainel,
  adicionarAcessoAoPainel,
  removerAcessoAoPainel,
  emailDoAdmin,
} from '@/lib/autenticacao';
import { exigirEdicaoNoPainel, sessaoDoPainel } from '@/lib/guarda-painel';

/**
 * A equipe do painel: quem mais pode entrar e olhar.
 *
 * Mexer aqui é privilégio do dono, como toda alteração — e aqui a regra pesa
 * mais que nas outras rotas, porque esta é a única que decide quem tem acesso
 * a todas as outras. Um leitor que pudesse se promover tornaria o resto
 * decorativo.
 */
export async function GET() {
  if (!(await sessaoDoPainel())) {
    return NextResponse.json({ erro: 'não autorizado' }, { status: 401 });
  }
  return NextResponse.json({
    dono: emailDoAdmin(),
    equipe: listarAcessosDoPainel(),
  });
}

export async function POST(req: NextRequest) {
  const barrado = await exigirEdicaoNoPainel();
  if (barrado) return barrado;

  const { acao, email, nota } = (await req.json().catch(() => ({}))) ?? {};
  const dono = emailDoAdmin();

  if (acao === 'remover') {
    /**
     * O dono não sai da lista porque nunca esteve nela — ele vem do ambiente
     * (ver a migração 021). Este `if` é redundante com `removerAcessoAoPainel`,
     * que já ignora o endereço do dono, e existe assim mesmo: a defesa contra
     * se trancar para fora do próprio painel merece ser óbvia na leitura, não
     * só correta na execução.
     */
    if (!email || (dono && email.trim().toLowerCase() === dono)) {
      return NextResponse.json(
        { erro: 'o acesso do dono não pode ser removido' },
        { status: 400 }
      );
    }
    removerAcessoAoPainel(email);
    return NextResponse.json({ ok: true, equipe: listarAcessosDoPainel() });
  }

  if (!adicionarAcessoAoPainel(email ?? '', dono ?? '', nota)) {
    return NextResponse.json(
      { erro: 'e-mail inválido, ou é o próprio dono (que já vê tudo)' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, equipe: listarAcessosDoPainel() });
}
