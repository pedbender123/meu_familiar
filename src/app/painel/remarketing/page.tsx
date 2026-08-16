import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { contatos, listarEnvios } from '@/lib/remarketing';
import { PRODUTOS_PRINCIPAIS } from '@/lib/produtos';
import { Remarketing } from '@/components/painel/Remarketing';
import { Cartao, brl, OURO, VERMELHO, VIOLETA } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Remarketing', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Remarketing: quem já passou por aqui e pode voltar.
 *
 * ── O que esta tela é ─────────────────────────────────────────────────────
 *
 * Uma lista de gente com e-mail, recortada por onde parou, e um jeito de
 * mandar uma oferta escrita para cada uma. O texto é gerado por IA a partir
 * do que a pessoa respondeu e de uma ideia que você escreve — mas nada sai
 * sem você ler.
 *
 * ── O que ela nunca faz ───────────────────────────────────────────────────
 *
 * Enviar para quem se descadastrou. A checagem acontece duas vezes: quando a
 * lista é montada (a linha aparece barrada e não dá para marcar) e de novo no
 * instante do envio, porque a pessoa pode ter clicado em "sair" no meio.
 */
export default async function PaginaDeRemarketing() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const lista = contatos();
  const rascunhos = listarEnvios('rascunho');
  const enviados = listarEnvios('enviado');

  const clientes = lista.filter((c) => c.comprou.length > 0);
  const quentes = lista.filter((c) => !c.comprou.length && c.abriuCheckout);
  const saíram = lista.filter((c) => c.descadastrado);
  const receita = clientes.reduce((s, c) => s + c.gastouCentavos, 0);

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Cartao rotulo="E-mails na base" valor={String(lista.length)} cor={VIOLETA} />
        <Cartao rotulo="Quase pagaram" valor={String(quentes.length)}
          nota="viram o checkout" cor={OURO} />
        <Cartao rotulo="Clientes" valor={String(clientes.length)}
          nota={`${brl(receita)} no total`} />
        <Cartao rotulo="Ofertas enviadas" valor={String(enviados.length)} />
        <Cartao rotulo="Esperando revisão" valor={String(rascunhos.length)} />
        <Cartao rotulo="Descadastraram" valor={String(saíram.length)}
          cor={saíram.length > 0 ? VERMELHO : undefined} />
      </div>

      <Remarketing
        contatos={lista}
        rascunhos={rascunhos}
        produtos={PRODUTOS_PRINCIPAIS.map((p) => ({
          id: p.id,
          nome: p.nome,
          precoCentavos: p.precoCentavos,
        }))}
      />
    </div>
  );
}
