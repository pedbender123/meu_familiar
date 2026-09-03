'use client';

import { useState } from 'react';
import { QrCode, CreditCard } from 'lucide-react';
import { OrderBumps, type EbookDoCheckout } from './OrderBumps';

/**
 * O checkout para olhar, não para pagar.
 *
 * ── O que é real aqui e o que é cenário ───────────────────────────────────
 *
 * Real: `OrderBumps` é o mesmo componente da tela que vende, com as mesmas
 * props, e os preços vêm do catálogo e de `precoVigenteCentavos`. Se alguém
 * mudar o preço de um ebook amanhã, esta página muda junto — e é isso que a
 * torna aprovável.
 *
 * Cenário: as abas de Pix e cartão não trocam nada, e no lugar do formulário
 * de pagamento fica uma faixa dizendo o que estaria ali. Montar o Brick de
 * verdade exigiria um pedido, um gateway e uma cobrança — e uma tela de
 * avaliação que cobra alguém por engano é o pior desfecho possível.
 *
 * ── Por que o produto é escolhível ────────────────────────────────────────
 *
 * Porque a pergunta do marketing não é "como está o checkout", é "como fica
 * o bump em cima de R$ 18,90 e em cima de R$ 24,90". A proporção entre a
 * oferta e o adicional é a coisa que está sendo avaliada, e ela muda com o
 * produto.
 */
export function DemonstracaoDoCheckout({
  ebooks,
  precoRevelacao,
  precoCompleta,
}: {
  ebooks: EbookDoCheckout[];
  precoRevelacao: number;
  precoCompleta: number;
}) {
  const [produto, setProduto] = useState<'revelacao' | 'completa'>('revelacao');
  const [marcados, setMarcados] = useState<string[]>([]);
  const [meio, setMeio] = useState<'pix' | 'cartao'>('pix');

  const base = produto === 'revelacao' ? precoRevelacao : precoCompleta;
  const extras = ebooks
    .filter((e) => marcados.includes(e.id))
    .reduce((s, e) => s + e.precoCentavos, 0);
  const total = base + extras;

  const reais = (c: number) =>
    (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const borda = 'color-mix(in srgb, var(--pergaminho) 14%, transparent)';

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      {/*
        A faixa de aviso fica no TOPO e não some.

        Uma tela de demonstração que parece a tela real é exatamente o tipo de
        coisa que alguém manda num grupo sem contexto — e três mensagens
        depois virou "o site está cobrando errado".
      */}
      <div
        className="rounded-xl border px-4 py-3 flex flex-col gap-1"
        style={{ borderColor: 'rgba(250,204,21,0.4)' }}
      >
        <span className="font-corpo text-[0.7rem] tracking-[0.14em] uppercase" style={{ color: '#FACC15' }}>
          Demonstração
        </span>
        <span className="font-corpo font-light text-[0.75rem] leading-snug text-pergaminho/55">
          Nada aqui cobra ninguém. É a tela de pagamento com dados de exemplo,
          para avaliar o desenho antes de subir. Os preços e os ebooks são os
          de verdade, lidos do catálogo.
        </span>
      </div>

      {/* O seletor que só existe aqui: a tela real já sabe qual produto é. */}
      <div className="flex flex-col gap-2">
        <span className="font-corpo text-[0.62rem] tracking-[0.16em] uppercase text-pergaminho/35 px-1">
          Ver com
        </span>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border p-1.5" style={{ borderColor: borda }}>
          {(
            [
              ['revelacao', 'Revelação', precoRevelacao],
              ['completa', 'Completa', precoCompleta],
            ] as const
          ).map(([id, rotulo, preco]) => (
            <button
              key={id}
              onClick={() => setProduto(id)}
              className="rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 transition"
              style={{
                background: produto === id ? 'rgba(217,164,65,0.1)' : 'transparent',
                color: produto === id ? 'var(--vela)' : 'color-mix(in srgb, var(--pergaminho) 60%, transparent)',
              }}
            >
              <span className="font-corpo text-[0.8rem]">{rotulo}</span>
              <span className="font-corpo text-[0.7rem] tabular-nums opacity-70">{reais(preco)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* As abas, do jeito que a tela real desenha. */}
      <div role="tablist" className="grid grid-cols-2 gap-2 rounded-2xl border p-1.5" style={{ borderColor: borda }}>
        {(
          [
            ['pix', 'Pix', 'Na hora', <QrCode key="p" size={16} strokeWidth={1.5} />],
            ['cartao', 'Cartão', 'À vista', <CreditCard key="c" size={16} strokeWidth={1.5} />],
          ] as const
        ).map(([id, rotulo, detalhe, icone]) => (
          <button
            key={id}
            onClick={() => setMeio(id)}
            className="rounded-xl px-3 py-2.5 flex items-center justify-center gap-2 transition"
            style={{
              background: meio === id ? 'rgba(217,164,65,0.1)' : 'transparent',
              color: meio === id ? 'var(--vela)' : 'color-mix(in srgb, var(--pergaminho) 60%, transparent)',
            }}
          >
            {icone}
            <span className="flex flex-col items-start leading-tight">
              <span className="font-corpo text-[0.82rem]">{rotulo}</span>
              <span className="font-corpo text-[0.65rem] opacity-60">{detalhe}</span>
            </span>
          </button>
        ))}
      </div>

      {/* O componente REAL. */}
      <OrderBumps
        ebooks={ebooks}
        marcados={marcados}
        aoMarcar={(id) =>
          setMarcados((a) => (a.includes(id) ? a.filter((v) => v !== id) : [...a, id]))
        }
      />

      {/* O total, que é o que a decisão de marcar muda. */}
      <div className="flex flex-col gap-1.5 rounded-xl border px-4 py-3.5" style={{ borderColor: borda }}>
        <div className="flex items-center justify-between">
          <span className="font-corpo text-[0.78rem] text-pergaminho/55">
            {produto === 'revelacao' ? 'Revelação' : 'Revelação Completa'}
          </span>
          <span className="font-corpo text-[0.78rem] tabular-nums text-pergaminho/70">{reais(base)}</span>
        </div>

        {ebooks
          .filter((e) => marcados.includes(e.id))
          .map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3">
              <span className="font-corpo font-light text-[0.75rem] text-pergaminho/45 truncate">
                {e.titulo}
              </span>
              <span className="font-corpo text-[0.75rem] tabular-nums text-pergaminho/50 shrink-0">
                {reais(e.precoCentavos)}
              </span>
            </div>
          ))}

        <div
          className="flex items-center justify-between pt-2.5 mt-1 border-t"
          style={{ borderColor: 'color-mix(in srgb, var(--pergaminho) 10%, transparent)' }}
        >
          <span className="font-corpo text-[0.82rem] text-pergaminho/70">Total</span>
          <span className="font-display text-xl tabular-nums text-vela">{reais(total)}</span>
        </div>
      </div>

      {/* No lugar do formulário: o que estaria ali. */}
      <div
        className="rounded-xl border border-dashed px-5 py-8 flex flex-col items-center gap-1.5 text-center"
        style={{ borderColor: borda }}
      >
        <span className="font-corpo text-[0.78rem] text-pergaminho/45">
          {meio === 'pix' ? 'Aqui aparece o QR Code do Pix' : 'Aqui aparece o formulário do cartão'}
        </span>
        <span className="font-corpo font-light text-[0.7rem] text-pergaminho/30 max-w-[34ch] leading-snug">
          Cobrando {reais(total)}. Nesta página o pagamento não existe — é a
          única parte que não é real.
        </span>
      </div>
    </div>
  );
}
