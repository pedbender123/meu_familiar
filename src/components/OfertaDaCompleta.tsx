import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { PRECO_DA_MELHORIA_CENTAVOS } from '@/nucleo/melhoria';

/**
 * O upgrade para a Revelação Completa, oferecido na própria revelação.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 *
 * A melhoria já estava pronta em código — a página `/melhorar/[id]`, a rota
 * que cobra, o preço, a confirmação por webhook — e **nada no site levava até
 * ela**. Uma página de compra sem nenhum link é receita que nunca acontece.
 *
 * ── Por que aqui ──────────────────────────────────────────────────────────
 *
 * É o melhor momento do funil: a pessoa acabou de ler o que comprou e está
 * satisfeita. Oferecer antes seria interromper o ritual; oferecer depois, por
 * e-mail apenas, é falar com quem já fechou a aba. Os dois acontecem — este
 * bloco e o bloco no e-mail de entrega —, porque nem todo mundo volta ao link
 * e nem todo mundo abre o e-mail.
 *
 * ── Onde NÃO aparece ──────────────────────────────────────────────────────
 *
 * Quem já tem a Completa, quem já pagou a melhoria, os exemplos do mural, e
 * quem chegou pelo link compartilhado sem ser a dona. Oferecer a alguém o que
 * ela já comprou é o tipo de erro que custa a confiança do comprador inteiro.
 * Quem filtra é `podeMelhorar`, junto do `ehADona` de quem renderiza.
 */
export function OfertaDaCompleta({ pedidoId }: { pedidoId: string }) {
  const preco = (PRECO_DA_MELHORIA_CENTAVOS / 100).toFixed(2).replace('.', ',');

  return (
    <section className="w-full max-w-md rounded-2xl border border-ouro-velho/25 bg-ouro-velho/[0.07] px-6 py-6 text-center">
      <Sparkles size={20} className="mx-auto mb-3 text-ouro-velho" aria-hidden />

      <h2 className="font-display italic text-xl leading-snug text-pergaminho">
        Ficou faltando o resto da sua leitura
      </h2>

      <p className="mt-2 font-corpo text-sm leading-relaxed text-pergaminho/70">
        A Revelação Completa abre o relatório inteiro do seu perfil — os
        gráficos, as leituras que ficaram de fora e a narração em áudio.
      </p>

      <Link
        href={`/melhorar/${pedidoId}`}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-ouro-velho px-6 py-3 font-corpo text-sm font-medium text-noite transition hover:brightness-110"
      >
        Completar por mais R$ {preco}
      </Link>

      <p className="mt-3 font-corpo text-xs text-pergaminho/40">
        Pagamento único. O que você já recebeu continua seu.
      </p>
    </section>
  );
}
