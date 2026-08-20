import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { escadaDaOferta } from '@/nucleo/oferta';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { OfertaDepoisDoRitual } from '@/plataforma/OfertaDepoisDoRitual';
import { MarcoDaOferta } from '@/components/MarcoDaOferta';

export const metadata = {
  title: 'Seu familiar atravessou · Bruxário',
  robots: { index: false, follow: false },
};

/**
 * A tela logo depois do ritual — onde a plataforma se apresenta.
 *
 * ── Por que ela existe ────────────────────────────────────────────────────
 *
 * Antes, `entregue` mandava direto para `/revelacao/[id]`: a pessoa lia o
 * familiar, fechava a aba e nunca ficava sabendo que existe um Oráculo, um
 * calendário e um retrato. O produto entregava e desaparecia.
 *
 * Este é o único momento em que ela está com a atenção inteira aqui — acabou
 * de fazer um ritual de treze minutos e quer saber o resultado. É o lugar
 * certo para mostrar o resto, e o único.
 *
 * ── E por que a saída para o grátis é grande ──────────────────────────────
 *
 * Um muro aqui seria trair o que a landing prometeu ("o ritual é de graça") e
 * queimar a pessoa no momento de maior boa vontade dela. A oferta aparece
 * primeiro porque é a hora, mas ver o familiar é um clique — sem letra
 * pequena, sem "não, obrigado, prefiro continuar pobre".
 */
export default async function Oferta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  // Ainda gerando: a tela de espera é quem cuida disso.
  if (pedido.status !== 'entregue') redirect(`/obrigado/${id}`);

  const familiar = FAMILIARES[pedido.familiar as FamiliarId];
  const leitura = pedido.leitura_json ? JSON.parse(pedido.leitura_json) : null;

  /**
   * A escada da oferta, e não a vitrine.
   *
   * A `/planos` compara assinaturas para quem já decidiu ficar. Aqui são três
   * opções fixas, na ordem em que a decisão fica fácil — duas avulsas e a
   * recorrente por último. Ver `nucleo/oferta.ts`.
   */
  const planos = escadaDaOferta({
    // Quem já recebeu a chave de graça (o cron das horas seguintes) não vê
    // mais as compras únicas: elas eram a oferta daquele momento, e o momento
    // passou. Ver `nucleo/oferta.ts`.
    avulsas: !pedido.acesso_gratis_em,
  }).map((item) => ({
    id: item.plano.id,
    nome: item.plano.nome,
    precoCentavos: item.plano.preco_centavos,
    recorrente: item.recorrente,
    chamada: item.chamada,
    ganhos: item.ganhos,
  }));

  return (
    <>
      {/*
        Sem isto a tela de venda mais importante do funil não existia no
        painel: `plano_visto` só era marcado em `/seu-familiar`, que é a
        oferta do fluxo antigo.
      */}
      <MarcoDaOferta />
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center px-5 py-12 sm:py-16">
        <div className="w-full max-w-2xl flex flex-col items-center gap-10">
          <header className="flex flex-col items-center gap-4 text-center">
            {familiar && (
              <SigiloFamiliar sigilo={familiar.sigilo} tamanho={120} variante="quarto" />
            )}
            <div className="flex flex-col gap-1.5">
              <h1 className="font-display italic text-3xl sm:text-4xl text-pergaminho leading-tight text-balance">
                {familiar ? `${familiar.nome} atravessou.` : 'O seu familiar atravessou.'}
              </h1>
              {leitura?.nome_secreto && (
                <p className="font-ritual text-3xl text-vela leading-none">
                  {leitura.nome_secreto}
                </p>
              )}
            </div>
            <p className="font-corpo font-light text-sm text-pergaminho/55 max-w-[38ch] leading-relaxed">
              A leitura sobre você já está escrita. Falta abrir.
            </p>
          </header>

          <OfertaDepoisDoRitual pedidoId={id} planos={planos} />
        </div>
      </main>
    </>
  );
}
