import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { ITENS } from '@/lib/quiz/itens';
import { produtoDe } from '@/lib/produtos';
import { RitualPago } from './RitualPago';

export const metadata = {
  title: 'O caminho até ele — Bruxário',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * O ritual pago: as cenas que faltam entre o pagamento e a revelação.
 *
 * ── Este link é o produto ─────────────────────────────────────────────────
 *
 * `/ritual/<id>` vai no e-mail de confirmação e no de resgate. Ele retoma de
 * onde parou porque cada resposta é gravada no pedido na hora (ver a rota) —
 * a pessoa pode fechar a aba no ônibus e abrir no notebook à noite.
 *
 * ── Portões ───────────────────────────────────────────────────────────────
 *
 * Sem pagar → volta para a oferta. Entregue → revelação. Completo mas ainda
 * gerando → tela de espera. O ritual em si só existe no estado "pago e
 * incompleto".
 */
export default async function PaginaDoRitualPago({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  if (pedido.status === 'aguardando_pagamento') redirect(`/seu-familiar/${id}`);
  if (pedido.status === 'entregue') redirect(`/revelacao/${id}`);
  if (pedido.ritual_completo === 1) redirect(`/obrigado/${id}`);

  const respondidas: Record<string, number> = (() => {
    try {
      return JSON.parse(pedido.respostas_json).quiz ?? {};
    } catch {
      return {};
    }
  })();

  const restantes = ITENS.filter((i) => typeof respondidas[i.id] !== 'number');

  // Ordem de exibição das opções, sorteada no servidor (SPEC 2.6) — cada
  // visita ganha a sua, estável enquanto a aba viver.
  const ordem: Record<string, number[]> = {};
  for (const item of restantes) {
    const indices = item.opcoes.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    ordem[item.id] = indices;
  }

  return (
    <RitualPago
      pedidoId={id}
      nome={pedido.nome}
      itens={restantes}
      ordemDasOpcoes={ordem}
      jaRespondidas={ITENS.length - restantes.length}
      total={ITENS.length}
      comAudio={produtoDe(pedido.produto).narracaoAudio}
    />
  );
}
