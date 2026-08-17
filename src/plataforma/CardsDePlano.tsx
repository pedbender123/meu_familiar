'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface PlanoNaTela {
  id: string;
  nome: string;
  precoCentavos: number;
  porMesCentavos: number;
  anual: boolean;
  familia: string;
  beneficios: string[];
  parcelasMax: number;
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Os planos, com o pulo mensal/anual.
 *
 * ── Por que o preço mostrado é sempre o POR MÊS ───────────────────────────
 *
 * "R$ 358,80" ao lado de "R$ 39,90" faz o anual parecer dez vezes mais caro,
 * quando ele é 25% mais barato. Comparar preços de prazos diferentes só
 * funciona na mesma unidade — daí o valor por mês em destaque e o total
 * cobrado logo abaixo, em letra menor mas sempre visível: esconder o total
 * seria a versão desonesta do mesmo truque.
 */
export function CardsDePlano({
  planos,
  autenticado,
}: {
  planos: PlanoNaTela[];
  autenticado: boolean;
}) {
  const router = useRouter();
  const [anual, setAnual] = useState(false);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const visiveis = planos.filter((p) => p.anual === anual);

  async function assinar(planoId: string) {
    setErro(null);

    // Sem conta não há o que cobrar: o ritual é grátis e cria a conta, então
    // mandar pro ritual é ao mesmo tempo o cadastro e a melhor primeira
    // experiência — bem melhor que uma tela de "crie sua conta".
    if (!autenticado) {
      router.push('/ritual');
      return;
    }

    setCarregando(planoId);
    try {
      const resposta = await fetch('/api/planos/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoId }),
      });
      const corpo = await resposta.json();

      if (corpo?.erro === 'nao_autenticado') {
        router.push('/entrar');
        return;
      }
      if (!resposta.ok || !corpo?.redirect) {
        setErro(corpo?.erro ?? 'Não consegui abrir o pagamento.');
        return;
      }
      router.push(corpo.redirect);
    } catch {
      setErro('Não consegui abrir o pagamento. Tente de novo.');
    } finally {
      setCarregando(null);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-7">
      {/* ── mensal / anual ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-full border border-pergaminho/15">
        {[false, true].map((ehAnual) => (
          <button
            key={String(ehAnual)}
            onClick={() => setAnual(ehAnual)}
            className={[
              'font-corpo text-xs px-4 py-2 rounded-full transition-colors',
              anual === ehAnual
                ? 'bg-vela text-tinta font-medium'
                : 'text-pergaminho/55 hover:text-pergaminho',
            ].join(' ')}
          >
            {ehAnual ? 'Anual' : 'Mensal'}
            {ehAnual && anual !== ehAnual && (
              <span className="text-vela"> · economize</span>
            )}
          </button>
        ))}
      </div>

      <div className="w-full grid gap-4 sm:grid-cols-2">
        {visiveis.map((plano) => {
          const destaque = plano.familia === 'acompanhamento';
          return (
            <div
              key={plano.id}
              className="flex flex-col gap-5 p-6 rounded-2xl border"
              style={{
                borderColor: destaque
                  ? 'rgba(217,164,65,0.45)'
                  : 'rgba(234,224,204,0.14)',
                background: destaque
                  ? 'linear-gradient(165deg, rgba(217,164,65,0.09), rgba(234,224,204,0.02))'
                  : 'rgba(234,224,204,0.03)',
              }}
            >
              <div className="flex flex-col gap-1">
                {destaque && (
                  <span className="font-corpo text-[0.55rem] tracking-[0.2em] uppercase text-vela">
                    o mais completo
                  </span>
                )}
                <h3 className="font-display italic text-2xl text-pergaminho leading-tight">
                  {plano.nome.replace(' · anual', '')}
                </h3>
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-3xl text-vela">
                    {reais(plano.porMesCentavos)}
                  </span>
                  <span className="font-corpo text-xs text-pergaminho/45">/mês</span>
                </div>
                {plano.anual && (
                  <span className="font-corpo text-[0.68rem] text-pergaminho/40">
                    {reais(plano.precoCentavos)} por ano
                    {plano.parcelasMax > 1 && `, em até ${plano.parcelasMax}x`}
                  </span>
                )}
              </div>

              <ul className="flex flex-col gap-2">
                {plano.beneficios.map((beneficio) => (
                  <li key={beneficio} className="flex items-start gap-2">
                    <svg
                      width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke={destaque ? 'var(--vela)' : 'currentColor'}
                      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                      aria-hidden="true"
                      className="mt-[3px] shrink-0 text-pergaminho/40"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="font-corpo font-light text-sm text-pergaminho/70 leading-snug">
                      {beneficio}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => assinar(plano.id)}
                disabled={carregando === plano.id}
                className={[
                  'mt-auto font-corpo text-sm px-6 py-3 rounded-full transition-all disabled:opacity-50',
                  destaque
                    ? 'bg-vela text-tinta font-medium hover:brightness-110'
                    : 'border border-vela/50 text-vela hover:bg-vela/10',
                ].join(' ')}
              >
                {carregando === plano.id ? 'Abrindo...' : 'Assinar'}
              </button>
            </div>
          );
        })}
      </div>

      {erro && (
        <p role="alert" className="font-corpo text-sm text-vela">
          {erro}
        </p>
      )}

      <p className="font-corpo text-xs text-pergaminho/35 text-center max-w-[40ch] leading-relaxed">
        Sem fidelidade. Você paga o período e decide se continua — o que já é
        seu continua seu de qualquer jeito.
      </p>
    </div>
  );
}
