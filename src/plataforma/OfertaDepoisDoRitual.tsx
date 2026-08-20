'use client';

import { useState } from 'react';
import { marcar } from '@/lib/marcar';
import { MARCO_DO_DEGRAU } from '@/nucleo/oferta-degraus';

export interface PlanoDaOferta {
  id: string;
  nome: string;
  precoCentavos: number;
  recorrente: boolean;
  chamada: string;
  ganhos: string[];
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * A oferta, e a porta de saída ao lado dela.
 *
 * ── A ordem na tela é a decisão inteira ───────────────────────────────────
 *
 * A oferta vem primeiro porque este é o único momento de atenção total da
 * pessoa. Mas o botão de ver o familiar é **grande, claro e primário** — não
 * um link cinza no rodapé.
 *
 * O truque de esconder a saída funciona uma vez e custa a confiança de
 * sempre: quem se sente empurrada num produto de assinatura cancela no
 * primeiro mês, e conta pra alguém. A landing prometeu que o ritual é de
 * graça; a tela imediatamente seguinte é onde essa promessa é testada.
 *
 * ── Escada, não comparação ────────────────────────────────────────────────
 *
 * Cada card mostra só o que ele **acrescenta** ao anterior, e não a lista
 * inteira do que entrega. Três listas completas lado a lado obrigam a pessoa
 * a fazer um diff de cabeça em pé no celular; a escada deixa a diferença
 * óbvia e a decisão pequena — "vale mais oito reais?" em vez de "qual desses
 * três eu escolho?".
 */
export function OfertaDepoisDoRitual({
  pedidoId,
  planos,
}: {
  pedidoId: string;
  planos: PlanoDaOferta[];
}) {
  const [indo, setIndo] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  async function comprar(planoId: string) {
    if (indo) return;
    setIndo(planoId);
    setErro('');

    /**
     * Marca a intenção ANTES de sair da tela.
     *
     * A pessoa clicou; se a rota falhar ou ela desistir no checkout, a
     * intenção existiu e é justamente essa diferença que diz onde o funil
     * perde dinheiro. Marcar depois do redirecionamento perderia todos os
     * cliques que não completaram — que são os que interessam.
     */
    const marco = MARCO_DO_DEGRAU[planoId as keyof typeof MARCO_DO_DEGRAU];
    if (marco) marcar(marco as Parameters<typeof marcar>[0]);
    marcar('pagamento_aberto');
    /*
      Nenhum evento de Meta sai daqui.

      O clique vira `InitiateCheckout` no servidor, quando a cobrança é criada
      pela rota abaixo — que é o mesmo instante, sem depender de o navegador
      conseguir falar com a Meta. Os `marcar()` acima continuam: são do nosso
      painel, e medir a intenção antes de sair da tela é o que eles existem
      para fazer.
    */
    try {
      const r = await fetch(`/api/oferta/${pedidoId}/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoId }),
      });
      const d = await r.json();
      if (!r.ok || !d.redirect) {
        setErro(d.erro || 'Não consegui abrir o pagamento. Tente de novo.');
        setIndo(null);
        return;
      }
      window.location.assign(d.redirect);
    } catch {
      setErro('O véu está denso. Tente de novo em instantes.');
      setIndo(null);
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-8">
      <section className="w-full flex flex-col gap-5">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
            o que ele ainda não te contou
          </p>
          <h2 className="font-display italic text-xl sm:text-2xl text-pergaminho text-balance max-w-[26ch] leading-tight">
            O seu familiar sabe mais do que cabe numa imagem.
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {planos.map((plano, i) => {
            const destaque = plano.recorrente;
            return (
              <article
                key={plano.id}
                className="flex flex-col gap-3.5 p-5 rounded-2xl border"
                style={{
                  borderColor: destaque
                    ? 'rgba(217,164,65,0.45)'
                    : 'rgba(234,224,204,0.14)',
                  background: destaque
                    ? 'linear-gradient(165deg, rgba(217,164,65,0.1), rgba(234,224,204,0.02))'
                    : 'rgba(234,224,204,0.03)',
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display italic text-lg text-pergaminho leading-tight">
                      {plano.nome}
                    </h3>
                    <p className="font-corpo font-light text-[0.8rem] text-pergaminho/60 leading-snug max-w-[34ch]">
                      {plano.chamada}
                    </p>
                  </div>
                  <span className="font-display text-xl text-vela shrink-0 whitespace-nowrap">
                    {reais(plano.precoCentavos)}
                    {plano.recorrente && (
                      <span className="font-corpo text-[0.6rem] text-pergaminho/40">/mês</span>
                    )}
                  </span>
                </div>

                <ul className="flex flex-col gap-1.5">
                  {/*
                    "Tudo do anterior, mais:" só a partir do segundo card — no
                    primeiro não há anterior, e a frase mentiria.
                  */}
                  {i > 0 && (
                    <li className="font-corpo text-[0.72rem] uppercase tracking-[0.14em] text-pergaminho/35">
                      tudo do anterior, e:
                    </li>
                  )}
                  {plano.ganhos.map((g) => (
                    <li
                      key={g}
                      className="font-corpo font-light text-[0.82rem] text-pergaminho/75 leading-snug flex gap-2"
                    >
                      <span aria-hidden="true" className="text-vela/60">
                        ·
                      </span>
                      {g}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => comprar(plano.id)}
                  disabled={!!indo}
                  className={[
                    'mt-1 text-center font-corpo text-sm px-5 py-2.5 rounded-full transition-all disabled:opacity-50',
                    destaque
                      ? 'bg-vela text-tinta font-medium hover:brightness-110'
                      : 'border border-vela/50 text-vela hover:bg-vela/10',
                  ].join(' ')}
                >
                  {indo === plano.id ? 'Abrindo...' : 'Quero este'}
                </button>

                {plano.recorrente && (
                  <p className="font-corpo text-[11px] text-pergaminho/35 text-center leading-relaxed">
                    Renova todo mês. Dá para cancelar quando quiser.
                  </p>
                )}
              </article>
            );
          })}
        </div>

        {erro && (
          <p className="font-corpo text-sm text-center text-red-400">{erro}</p>
        )}
      </section>

      {/*
        ── Nenhum indício do grátis nesta tela ─────────────────────────────

        Havia aqui um botão grande de "ver o meu familiar agora", com a
        justificativa de não trair a promessa da landing. A promessa é outra:
        o RITUAL é de graça, e ele já aconteceu — a pessoa atravessou 26
        cenas e a leitura sobre ela está escrita. Isso é o produto.

        Esta tela existe para vender. Oferecer uma saída gratuita ao lado dos
        preços é ensinar que o preço é opcional, e quem sai por ali quase
        nunca volta pagando. O funil é de VENDAS — quem chegou até aqui já
        provou interesse atravessando o ritual inteiro.

        O que é de graça continua de graça e continua sendo entregue: o nome e
        a imagem do familiar chegam por e-mail, e o acesso à conta gratuita
        chega depois, também por e-mail (`scripts/acesso-gratis.ts`). Fica em
        letra miúda porque é informação verdadeira que a pessoa precisa ter —
        não porque é uma oferta concorrente.
      */}
      <p className="font-corpo text-[11px] text-pergaminho/35 text-center max-w-[40ch] leading-relaxed pt-2 border-t border-pergaminho/10 mt-2">
        O nome e a imagem do seu familiar vão para o seu e-mail de qualquer
        forma. A leitura escrita sobre você é o que abre acima.
      </p>
    </div>
  );
}
