import { notFound, redirect } from 'next/navigation';
import { chavePublica, modoAtual, pagamentoEhFake } from '@/nucleo/checkouts/mercadopago';
import { buscarCobranca } from '@/nucleo/cobrancas';
import { buscarPlano, direitosDoPlano } from '@/nucleo/planos';
import { Checkout } from '@/components/checkout/Checkout';
import { gatewayConferido } from '@/nucleo/checkouts/gateway';
import { pagadorDaConta } from '@/lib/acesso-plataforma';
import { PagamentoFake } from '@/components/PagamentoFake';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { MarcoDoCheckout } from '@/components/MarcoDoCheckout';

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

  /*
    Quem cobra, resolvido ANTES de pintar a tela — e sondando a Wiven, para
    não abrir um checkout apontado para um gateway que não está respondendo.

    Sem campanha: assinatura não vem de anúncio, vem de quem já é cliente.
  */
  const gatewayPix = await gatewayConferido('pix');
  const gatewayCartao = await gatewayConferido('cartao');

  /*
    A Wiven exige nome e documento do pagador, e a `cobranca` só guarda
    e-mail. O último pedido da pessoa tem os dois — ela já comprou aqui, é
    por isso que está vendo uma oferta de assinatura.
  */
  const pagador = pagadorDaConta(cobranca.email);

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
      {/*
        O checkout de plano nascia sem medição nenhuma. `checkout_aberto` só
        existia em `/pagamento/[id]`, do funil antigo — então a queda entre
        "clicou no plano" e "viu a tela de pagar", que é o degrau mais caro do
        funil, era invisível para a assinatura.

        O id usado no `eventId` é o da COBRANÇA, não o do pedido: é ele que
        identifica esta tentativa de pagamento, e é ele que o webhook vai
        reencontrar depois para o `Purchase` deduplicar contra este evento.
      */}
      <MarcoDoCheckout pedidoId={cobranca.id} valorEmReais={cobranca.valor_centavos / 100} />
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        {pagamentoEhFake() || !chave ? (
          <PagamentoFake pedidoId={id} base="cobranca" />
        ) : (
          <Checkout
            base="cobranca"
            destino="/conta?assinatura=ok"
            pedidoId={id}
            chavePublica={chave}
            valorEmReais={cobranca.valor_centavos / 100}
            nomeProduto={plano.nome}
            itens={itens}
            modo={modoAtual()}
            nome={pagador.nome ?? cobranca.email.split('@')[0]}
            cpf={pagador.cpf}
            gatewayPix={gatewayPix}
            gatewayCartao={gatewayCartao}
          />
        )}
      </main>
    </>
  );
}
