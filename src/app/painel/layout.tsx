import { sessaoAtual } from '@/lib/sessao-servidor';
import { podeEditarPainel } from '@/lib/autenticacao';
import { contatosAbertos, comentariosPendentes } from '@/lib/db';
import { Shell, type Area } from '@/components/painel/Shell';
import { listarEnvios } from '@/lib/remarketing';

export const dynamic = 'force-dynamic';

/**
 * A moldura de toda a área administrativa.
 *
 * ── Por que a tela de entrar não recebe o shell ───────────────────────────
 *
 * Ela é o único lugar do `/painel` que existe SEM sessão — desenhar a barra
 * lateral ali seria mostrar o menu de uma casa em que a pessoa ainda não
 * entrou. Sem sessão, o layout some e cada página cuida de si (a de entrar se
 * desenha inteira; as outras redirecionam).
 *
 * ── O script que evita o piscar ───────────────────────────────────────────
 *
 * O tema vive no `localStorage`, que só existe no navegador. Sem este script
 * o servidor mandaria sempre o escuro e quem escolheu claro veria a tela
 * trocar de cor depois de pintada. Ele roda antes da primeira pintura, é
 * minúsculo, e falha em silêncio se o storage estiver bloqueado.
 */
const SCRIPT_DO_TEMA = `try{
  var t = localStorage.getItem('bx_admin_tema');
  if (t !== 'claro' && t !== 'escuro') t = 'escuro';
  document.currentScript.parentElement.setAttribute('data-tema', t);
}catch(e){}`;

export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') return <>{children}</>;

  // O dono altera; a equipe só olha. A distinção desce para o Shell porque é
  // ela que decide o aviso no topo e o item de menu da Equipe.
  const dono = podeEditarPainel(sessao.email);

  // As contagens que viram bolinha no menu. São duas consultas leves e dizem
  // "tem coisa te esperando" sem exigir que você abra cada área para olhar.
  const abertos = contatosAbertos().length;
  const pendentes = comentariosPendentes().length;
  const rascunhosPendentes = listarEnvios('rascunho').length;

  const areas: Area[] = [
    { href: '/painel/central', rotulo: 'Central', icone: 'grafico' },
    { href: '/painel/campanhas', rotulo: 'Campanhas', icone: 'alvo' },
    { href: '/painel/rastreio', rotulo: 'Rastreio', icone: 'grafico' },
    { href: '/painel/pedidos', rotulo: 'Pedidos', icone: 'caixa' },
    { href: '/painel/remarketing', rotulo: 'Remarketing', icone: 'megafone', alerta: rascunhosPendentes },
    { href: '/painel/financeiro', rotulo: 'Financeiro', icone: 'moeda' },
    { href: '/painel/cupons', rotulo: 'Cupons', icone: 'etiqueta' },
    { href: '/painel/contatos', rotulo: 'Contatos & Mural', icone: 'carta', alerta: abertos + pendentes },
    { href: '/painel/marcacoes', rotulo: 'Marcações', icone: 'estrela' },
    /*
      A Equipe só existe para o dono. Não é esconder por vergonha: quem é da
      equipe não pode mexer nela, e um item de menu que leva a um redirect é
      pior que item nenhum.
    */
    ...(dono
      ? [{ href: '/painel/equipe', rotulo: 'Equipe', icone: 'estrela' as const }]
      : []),
  ];

  return (
    /*
      `suppressHydrationWarning` porque o script abaixo TROCA `data-tema` antes
      de o React hidratar: o servidor mandou "escuro", o script pôs "claro", e
      o React acusaria divergência de atributo. A divergência é intencional —
      é exatamente assim que o piscar de tema é evitado — e vale só para este
      atributo, neste nó.
    */
    <div className="admin" data-tema="escuro" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      <Shell areas={areas} email={sessao.email} somenteLeitura={!dono}>
        {children}
      </Shell>
    </div>
  );
}
