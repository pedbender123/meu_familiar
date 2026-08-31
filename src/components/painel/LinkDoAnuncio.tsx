'use client';

import { useState } from 'react';

/**
 * O link que vai no gerenciador de anúncios. Um só, para tudo.
 *
 * ── Por que esta caixa existe ─────────────────────────────────────────────
 *
 * Durante duas semanas o pedido feito a quem compra a mídia foi: "cole o
 * nosso `?c=` no link". Isso é pedir que ele aprenda um dialeto nosso, e o
 * custo apareceu inteiro numa venda — 27/08, criativo identificado no nosso
 * painel e invisível no dele, porque o link não trazia `utm_*`.
 *
 * Aqui não há nada para aprender. As macros entre chaves a Meta substitui
 * sozinha em toda entrega; é o mesmo link que ele já cola em qualquer outra
 * página de vendas. Campanha e criativo passam a nascer da primeira visita.
 *
 * ── Por que fica no topo da tela de campanhas ─────────────────────────────
 *
 * Porque é a única coisa desta tela que alguém de fora precisa. Tudo abaixo
 * é medição nossa; isto é o contrato.
 */
export function LinkDoAnuncio({ base }: { base: string }) {
  const [copiado, setCopiado] = useState(false);

  /*
    Numa linha só. Quebrado em várias, um copiar-e-colar desavisado leva o
    espaço junto e a URL chega quebrada no gerenciador — o tipo de erro que
    só aparece depois de o anúncio já ter gasto dinheiro.
  */
  const link =
    `${base}/vendas` +
    '?utm_source={{site_source_name}}' +
    '&utm_medium=paid' +
    '&utm_campaign={{campaign.id}}' +
    '&utm_content={{ad.id}}' +
    '&utm_term={{adset.id}}';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Área de transferência bloqueada: o link está na tela para copiar à mão.
    }
  }

  return (
    <section
      className="superficie w-full rounded-xl border px-5 py-4 flex flex-col gap-3"
      style={{ borderColor: 'rgba(217,164,65,0.35)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/85">
          O link do anúncio
        </h2>
        <span className="font-corpo text-[11px] text-pergaminho/40">
          é só este — não precisa de mais nada
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="flex-1 min-w-[20rem] font-mono text-[10.5px] leading-relaxed text-pergaminho/70 bg-pergaminho/[0.04] rounded-lg px-3 py-2 break-all">
          {link}
        </code>
        <button
          onClick={copiar}
          className="font-corpo text-[11px] px-3 py-2 rounded-lg border border-vela/40 text-vela hover:bg-vela/10 transition whitespace-nowrap"
        >
          {copiado ? 'copiado ✓' : 'copiar'}
        </button>
      </div>

      <p className="font-corpo font-light text-[11px] leading-relaxed text-pergaminho/45 max-w-[80ch]">
        As macros entre chaves a Meta preenche sozinha em cada entrega. Com
        elas, a campanha e o criativo aparecem aqui no painel sem ninguém
        cadastrar nada — e chegam na UTMify com o mesmo ID que têm no
        gerenciador, que é o que faz a venda cair dentro da campanha certa em
        vez de virar venda direta.
      </p>
    </section>
  );
}
