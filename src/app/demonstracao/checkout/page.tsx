import { notFound } from 'next/navigation';
import { ebooksParaCheckout } from '@/nucleo/biblioteca/catalogo';
import { precoVigenteCentavos } from '@/lib/modelo-de-venda';
import { DemonstracaoDoCheckout } from '@/components/checkout/Demonstracao';

export const metadata = {
  title: 'Checkout — demonstração',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

/**
 * O checkout desenhado, sem pedido e sem gateway.
 *
 * ── Para que ela existe ───────────────────────────────────────────────────
 *
 * O time de marketing precisa ver a tela antes de ela ir ao ar, e a tela real
 * exige um pedido de verdade: alguém teria que fazer as 26 cenas do ritual
 * para chegar até aqui, e o link morreria assim que o pedido fosse pago ou
 * expirasse. Para uma avaliação visual, isso é atrito sem retorno.
 *
 * Aqui os dados são de mentira e o formulário de pagamento não existe. O que
 * está sendo mostrado — os order bumps, o total somando ao vivo, a ordem dos
 * blocos — é o componente REAL, com as mesmas props que a tela verdadeira
 * passa. Uma cópia visual divergiria da tela real na primeira mudança, e
 * aprovar uma tela que não é a que vai ao ar é pior que não aprovar nada.
 *
 * ── Ela some em produção ──────────────────────────────────────────────────
 *
 * `notFound()` quando não é ambiente de teste. Uma página de demonstração
 * acessível no site que vende é uma porta que ninguém lembra que existe — e
 * um dia alguém acha, num buscador ou num link vazado, e conclui que os
 * preços dali são reais.
 */
export default function DemonstracaoCheckout() {
  const ehTeste =
    process.env.UTMIFY_TESTE === '1' ||
    process.env.MP_MODO === 'teste' ||
    process.env.NODE_ENV !== 'production';

  if (!ehTeste) notFound();

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-12">
      <DemonstracaoDoCheckout
        ebooks={ebooksParaCheckout()}
        precoRevelacao={precoVigenteCentavos('revelacao')}
        precoCompleta={precoVigenteCentavos('completa')}
      />
    </main>
  );
}
