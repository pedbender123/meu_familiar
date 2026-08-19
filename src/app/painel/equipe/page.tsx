import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import {
  listarAcessosDoPainel,
  emailDoAdmin,
  podeEditarPainel,
} from '@/lib/autenticacao';
import { EquipeDoPainel } from '@/components/painel/EquipeDoPainel';

export const metadata = { title: 'Equipe', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Quem mais entra no painel.
 *
 * A página existe só para o dono — e o `redirect` para a Central, em vez de
 * um "sem permissão", é deliberado: quem é da equipe não precisa saber que
 * esta tela existe, e a Central é onde ele tem o que fazer.
 */
export default async function Equipe() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');
  if (!podeEditarPainel(sessao.email)) redirect('/painel/central');

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <p className="font-corpo font-light text-xs text-pergaminho/45 max-w-[70ch] leading-relaxed">
        Quem estiver nesta lista pede o link em <code>/painel/entrar</code> com
        o próprio e-mail e entra para <strong>olhar</strong>. Ninguém aqui cria
        cupom, edita campanha, estorna pedido nem dispara remarketing — isso é
        só seu. Tirar alguém da lista derruba a sessão dele na hora.
      </p>
      <EquipeDoPainel
        dono={emailDoAdmin() ?? ''}
        inicial={listarAcessosDoPainel()}
      />
    </div>
  );
}
