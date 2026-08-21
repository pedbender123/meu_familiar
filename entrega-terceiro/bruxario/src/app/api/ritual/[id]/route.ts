import { NextRequest, NextResponse } from 'next/server';
import { buscarPedido, atualizarPedido, registrarEvento } from '@/lib/db';
import { excedeuLimite, LIMITES } from '@/lib/rate-limit';
import { ITENS } from '@/lib/quiz/itens';
import { pontuar, type Respostas } from '@/lib/quiz/pontuacao';
import { aplicarDesempate, opcoesDeDesempate } from '@/lib/quiz/desempate';
import type { FamiliarId } from '@/lib/familiares';
import { processarPedido } from '@/lib/processar';
import { falaDaParada } from '@/lib/mensagens-ritual';

/**
 * O ritual pago: uma resposta por POST, retomável de qualquer aparelho.
 *
 * ── Por que uma resposta por vez, e não o lote no fim ─────────────────────
 *
 * Porque a pessoa JÁ PAGOU. No funil antigo as respostas viviam no navegador
 * até o envio final — quem fechava a aba perdia tudo, e tudo bem, era grátis.
 * Aqui cada resposta é patrimônio de um pedido pago: gravar na hora é o que
 * faz o link do e-mail voltar exatamente para onde parou, e é o que permite
 * ao resgate entregar uma leitura parcial digna se a pessoa sumir de vez.
 *
 * ── Quem dispara a geração ────────────────────────────────────────────────
 *
 * A 26ª resposta. `pontuar` decide o familiar; empate devolve as duas
 * opções para a pessoa escolher (SPEC 2.4) e espera um segundo POST. Só
 * então `ritual_completo` vira 1 e `processarPedido` acorda.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  /**
   * Limitado pelo PEDIDO, não pelo IP, e com folga para as 26 cenas.
   *
   * O balde antigo era de dez por minuto por IP, compartilhado com metade das
   * rotas do site — o ritual travava na oitava cena, com a pessoa já tendo
   * pago. Um pedido custa dinheiro para existir, então a chave por pedido é
   * cara de forjar; e o IP puniria duas pessoas na mesma rede de celular.
   */
  if (excedeuLimite(`ritual:${id}`, LIMITES.ritual)) {
    return NextResponse.json({ erro: 'Aguarde um instante.' }, { status: 429 });
  }
  const pedido = buscarPedido(id);
  if (!pedido) {
    return NextResponse.json({ erro: 'pedido não encontrado' }, { status: 404 });
  }

  // O ritual pago é para quem pagou. Antes disso a pessoa pertence à tela de
  // oferta; depois de entregue, à revelação.
  if (pedido.status === 'aguardando_pagamento') {
    return NextResponse.json({ redirect: `/seu-familiar/${id}` }, { status: 409 });
  }
  if (pedido.status === 'entregue') {
    return NextResponse.json({ redirect: `/revelacao/${id}` }, { status: 409 });
  }
  if (pedido.ritual_completo === 1) {
    return NextResponse.json({ completo: true, redirect: `/obrigado/${id}` });
  }

  const corpo = (await req.json().catch(() => ({}))) ?? {};

  /* ── fala do familiar numa parada ── */
  if (typeof corpo.fala === 'number') {
    const parada = corpo.fala === 2 ? 2 : 1;
    const fala = await falaDaParada(id, parada);
    return NextResponse.json({ fala });
  }

  const dados = JSON.parse(pedido.respostas_json);
  const quiz: Record<string, number> = dados.quiz ?? {};

  /* ── uma resposta de cena ── */
  if (typeof corpo.item === 'string' && typeof corpo.escolha === 'number') {
    const item = ITENS.find((i) => i.id === corpo.item);
    if (!item || corpo.escolha < 0 || corpo.escolha > 3) {
      return NextResponse.json({ erro: 'resposta inválida' }, { status: 400 });
    }
    quiz[item.id] = corpo.escolha;
    const respondidas = ITENS.filter((i) => typeof quiz[i.id] === 'number').length;
    atualizarPedido(id, {
      respostas_json: JSON.stringify({ ...dados, quiz }),
      cenas_respondidas: respondidas,
    });

    if (respondidas < ITENS.length) {
      return NextResponse.json({ respondidas, total: ITENS.length });
    }
    // 26ª resposta: cai direto na finalização, sem exigir outro POST.
    return finalizar(id, quiz, undefined);
  }

  /* ── a escolha do desempate ── */
  if (typeof corpo.desempate === 'string') {
    return finalizar(id, quiz, corpo.desempate as FamiliarId);
  }

  return NextResponse.json({ erro: 'requisição inválida' }, { status: 400 });
}

function finalizar(
  pedidoId: string,
  quiz: Record<string, number>,
  desempate: FamiliarId | undefined
): NextResponse {
  let resultado = pontuar(quiz as Respostas);

  if (resultado.empate && !desempate) {
    return NextResponse.json({ empate: { entre: opcoesDeDesempate(resultado) } });
  }

  let desempatadoPelaPessoa = false;
  if (desempate) {
    const aplicado = aplicarDesempate(resultado, desempate);
    desempatadoPelaPessoa = aplicado.desempatadoPelaPessoa;
    resultado = aplicado;
  }

  atualizarPedido(pedidoId, {
    familiar: resultado.familiar,
    ritual_completo: 1,
    desempatado_pela_pessoa: desempatadoPelaPessoa ? 1 : 0,
    // SPEC 0.8: os 12 escores salvos, não só o vencedor — sobrescreve o
    // perfil parcial do mini-ritual pelo definitivo das 26.
    perfil_json: JSON.stringify({
      eixos: resultado.normalizado,
      bruto: resultado.bruto,
      angulo: resultado.angulo,
      magnitude: resultado.magnitude,
      afinidades: resultado.afinidades,
      empate: resultado.empate,
    }),
  });
  registrarEvento('ritual_completo', pedidoId);

  // Fogo e esquece: a pessoa vai para /obrigado, que faz poll até `entregue`.
  processarPedido(pedidoId);

  return NextResponse.json({ completo: true, redirect: `/obrigado/${pedidoId}` });
}
