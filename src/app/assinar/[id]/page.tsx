import { notFound, redirect } from 'next/navigation';
import { chavePublica, modoAtual, pagamentoEhFake } from '@/nucleo/checkouts/mercadopago';
import { buscarCobranca } from '@/nucleo/cobrancas';
import { buscarPlano, direitosDoPlano } from '@/nucleo/planos';
import { CheckoutMercadoPago } from '@/components/CheckoutMercadoPago';
import { PagamentoFake } from '@/components/PagamentoFake';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';

export const metadata = {
  title: 'Assinar · Bruxário',
  robots: { index: false, follow: false },
};

/**
 * O pagamento de um plano.
 *
 * Reaproveita o MESMO checkout do funil, apontado para `/api/cobranca/...`
 * pelo `base`. Um segundo componente de checkout seria a mesma integração com
 * o Brick duplicada — e dois checkouts que divergem é o tipo de coisa que só
 * se descobre quando um deles para de cobrar direito.
 */
export default async function Assinar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cobranca = buscarCobranca(id);
  if (!cobranca) notFound();

  // Já paga: não faz sentido mostrar checkout de novo.
  if (cobranca.status === 'pago') redirect('/conta?assinatura=ok');

  const plano = buscarPlano(cobranca.plano_id);
  if (!plano) notFound();

  const direitos = direitosDoPlano(plano);
  const chave = chavePublica();

  const itens = [
    direitos.leiturasPorMes > 0 &&
      `${direitos.leiturasPorMes} leitura${direitos.leiturasPorMes > 1 ? 's' : ''} do Oráculo por mês`,
    direitos.perguntasOraculo > 0 && `${direitos.perguntasOraculo} mensagens por mês`,
    direitos.relatorioCompleto && 'Relatório completo do seu perfil',
    direitos.alcanceCalendario === 'rolante'
      ? 'Calendário sempre com 12 meses à frente'
      : direitos.alcanceCalendario === 'ano'
        ? 'Calendário dos 12 meses à frente'
        : direitos.alcanceCalendario === 'mes' && 'Calendário do mês inteiro',
  ].filter(Boolean) as string[];

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        {pagamentoEhFake() || !chave ? (
          <PagamentoFake pedidoId={id} base="cobranca" />
        ) : (
          <CheckoutMercadoPago
            base="cobranca"
            destino="/conta?assinatura=ok"
            pedidoId={id}
            chavePublica={chave}
            valorEmReais={cobranca.valor_centavos / 100}
            nomeProduto={plano.nome}
            itens={itens}
            modo={modoAtual()}
          />
        )}
      </main>
    </>
  );
}
