import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { vitrineEmEscada, beneficiosDoGratuito } from '@/nucleo/vitrine';
import { CardsDePlano, type PlanoNaTela } from '@/plataforma/CardsDePlano';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';

export const metadata = {
  title: 'Planos · Bruxário',
  description:
    'O ritual é grátis. Os planos abrem o Oráculo, o calendário dos seus dias e o retrato completo.',
};

/**
 * A vitrine.
 *
 * ── O grátis aparece primeiro, e de propósito ─────────────────────────────
 *
 * Página de planos que esconde o gratuito converte pior, não melhor: quem
 * chega desconfiado vai embora, e quem entra de graça descobre o produto
 * usando. O grátis aqui não é concorrente dos pagos — é o degrau que leva
 * até eles, e mostrá-lo com honestidade é o que torna o resto crível.
 */
export default async function Planos() {
  const sessao = await sessaoAtual();
  const itens = vitrineEmEscada();
  const gratuito = beneficiosDoGratuito();

  /**
   * O destaque vai no card do MEIO, não no mais caro.
   *
   * É o âncora: o de baixo faz o do meio parecer completo, o de cima faz o do
   * meio parecer razoável. Destacar o mais caro empurra a decisão para o
   * extremo e faz a maioria escolher o mais barato por reação.
   */
  const mensais = itens.filter((i) => !i.anual);
  const doMeio = mensais[Math.floor((mensais.length - 1) / 2)]?.plano.id;

  const planos: PlanoNaTela[] = itens.map((item) => ({
    id: item.plano.id,
    nome: item.plano.nome,
    precoCentavos: item.plano.preco_centavos,
    porMesCentavos: item.porMesCentavos,
    anual: item.anual,
    familia: item.familia,
    beneficios: item.beneficios,
    ganhos: item.ganhos,
    parcelasMax: item.plano.parcelas_max,
    destaque: item.plano.id === doMeio,
  }));

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center px-5 py-14 sm:py-20">
        <div className="w-full max-w-3xl flex flex-col items-center gap-12">
          <header className="flex flex-col items-center gap-4 text-center">
            <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-pergaminho/35">
              Bruxário
            </p>
            <h1 className="font-display italic text-3xl sm:text-4xl text-pergaminho text-balance max-w-[20ch] leading-tight">
              Descobrir o seu familiar é de graça.
            </h1>
            <p className="font-corpo font-light text-sm sm:text-base text-pergaminho/55 max-w-[42ch] leading-relaxed">
              O que se paga é o que vem depois: o Oráculo que te responde, o
              calendário dos seus dias e o retrato inteiro de quem você é.
            </p>
          </header>

          {/* ── O que já é grátis ─────────────────────────────────────── */}
          <section className="w-full flex flex-col gap-4 p-6 rounded-2xl border border-pergaminho/12">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-display italic text-xl text-pergaminho">
                Sem pagar nada
              </h2>
              <Link
                href="/ritual"
                className="font-corpo text-sm text-vela hover:brightness-125 transition"
              >
                fazer o ritual →
              </Link>
            </div>

            <ul className="flex flex-col gap-1.5">
              <li className="font-corpo font-light text-sm text-pergaminho/70">
                O nome e a imagem do seu familiar, para sempre
              </li>
              {gratuito.map((beneficio) => (
                <li
                  key={beneficio}
                  className="font-corpo font-light text-sm text-pergaminho/70"
                >
                  {beneficio}
                </li>
              ))}
            </ul>
          </section>

          <CardsDePlano planos={planos} autenticado={sessao?.tipo === 'conta'} />

          <Link
            href="/"
            className="font-corpo text-xs text-pergaminho/30 hover:text-pergaminho/60 transition-colors"
          >
            voltar
          </Link>
        </div>
      </main>
    </>
  );
}
