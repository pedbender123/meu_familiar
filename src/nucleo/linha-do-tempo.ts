import db, { buscarPedido } from '../lib/db';
import { jornadaDoPedido } from '../lib/toques';

export type CategoriaDoPasso = 'marketing' | 'funil' | 'sistema' | 'pixel' | 'anomalia';

export interface PassoDaLinha {
  quando: string;
  categoria: CategoriaDoPasso;
  rotulo: string;
  detalhe?: string;
  /** Se este passo pode levar crédito de aquisição (só marketing usa isto). */
  conta: boolean;
  destino: string | null;
}

const ROTULO_DE_EVENTO: Record<string, string> = {
  pagamento_confirmado: 'Pagamento confirmado',
  geracao_iniciada: 'Geração iniciada',
  pedido_entregue: 'Entregue',
  pedido_erro: 'Erro na geração',
  email_falhou: 'E-mail falhou',
  email_pendente_apos_pagamento: 'Sem e-mail para enviar ainda',
  conta_criada: 'Conta criada',
  conta_acesso_enviado: 'Acesso enviado (conta já existia)',
  conta_falhou: 'Falha ao criar conta',
  narracao_falhou: 'Narração falhou',
  amostra_gerada: 'Amostra gerada (mural)',
  entrega_sem_email: 'Entregue, mas sem e-mail para enviar',
  ritual_pendente_apos_pagamento: 'Pagou — ritual longo ainda pendente',
  ritual_incompleto_na_geracao: 'Ritual incompleto na hora de gerar',
};

/**
 * "Cada pedido com todos os seus marcos em ordem, do primeiro clique ao
 * evento que chegou na Meta" — docs/reestruturacao.md, Fase 1.
 *
 * Junta cinco fontes que hoje vivem em telas/tabelas separadas — toques de
 * marketing, marcos do funil, eventos do sistema, o envio ao Conversions API
 * e anomalias da Sentinela — numa única linha do tempo ordenada. É a
 * pergunta que dói responder hoje espalhada em cinco lugares: "onde essa
 * venda parou, e o que foi tentado desde então?".
 */
export function linhaDoTempoDoPedido(pedidoId: string): PassoDaLinha[] {
  const pedido = buscarPedido(pedidoId);
  if (!pedido) return [];

  const passos: PassoDaLinha[] = [];

  // 1. Marketing — reaproveita a jornada que já existe (toques.ts), mesma
  // fonte que a tela de rastreio usa, pra não haver duas versões da verdade.
  for (const p of jornadaDoPedido(pedidoId)) {
    passos.push({
      quando: p.quando,
      categoria: 'marketing',
      rotulo: p.rotulo,
      conta: p.conta,
      destino: p.destino,
    });
  }

  // 2. Funil — os marcos de progresso, ligados pelo mesmo cookie de
  // visitante que os toques (marcos não têm pedido_id, nasceram antes de
  // existir pedido).
  if (pedido.visitante) {
    const marcos = db
      .prepare(`SELECT marco, valor, criado_em FROM marcos WHERE visitante = ? ORDER BY criado_em ASC`)
      .all(pedido.visitante) as { marco: string; valor: number | null; criado_em: string }[];
    for (const m of marcos) {
      passos.push({
        quando: m.criado_em,
        categoria: 'funil',
        rotulo: m.marco,
        detalhe: m.valor !== null ? `cena ${m.valor}` : undefined,
        conta: false,
        destino: null,
      });
    }
  }

  // 3. Sistema — o que o próprio backend registrou sobre ESTE pedido.
  const eventos = db
    .prepare(`SELECT tipo, criado_em FROM eventos WHERE pedido_id = ? ORDER BY criado_em ASC`)
    .all(pedidoId) as { tipo: string; criado_em: string }[];
  for (const e of eventos) {
    passos.push({
      quando: e.criado_em,
      categoria: 'sistema',
      rotulo: ROTULO_DE_EVENTO[e.tipo] ?? e.tipo,
      conta: false,
      destino: null,
    });
  }

  // 4. Pixel — o que chegou (ou não) na Meta via Conversions API.
  const capi = db
    .prepare(
      `SELECT evento_nome, status, tentativas, criado_em, enviado_em, ultimo_erro
         FROM fila_capi WHERE pedido_id = ? ORDER BY criado_em ASC`
    )
    .all(pedidoId) as {
    evento_nome: string;
    status: string;
    tentativas: number;
    criado_em: string;
    enviado_em: string | null;
    ultimo_erro: string | null;
  }[];
  for (const c of capi) {
    const rotuloStatus =
      c.status === 'enviado' ? 'enviado' : c.status === 'falhou_definitivo' ? 'DESISTIU' : 'na fila';
    passos.push({
      quando: c.enviado_em ?? c.criado_em,
      categoria: 'pixel',
      rotulo: `${c.evento_nome} pro Conversions API — ${rotuloStatus}`,
      detalhe:
        c.status === 'falhou_definitivo'
          ? `${c.tentativas} tentativas — ${c.ultimo_erro ?? 'erro desconhecido'}`
          : undefined,
      conta: false,
      destino: null,
    });
  }

  // 5. Anomalias — o que a Sentinela achou de errado especificamente aqui.
  const anomalias = db
    .prepare(
      `SELECT invariante, severidade, esperado, encontrado, ocorrido_em, resolvido_em
         FROM anomalias WHERE entidade_tipo = 'pedido' AND entidade_id = ? ORDER BY ocorrido_em ASC`
    )
    .all(pedidoId) as {
    invariante: string;
    severidade: string;
    esperado: string;
    encontrado: string;
    ocorrido_em: string;
    resolvido_em: string | null;
  }[];
  for (const a of anomalias) {
    passos.push({
      quando: a.ocorrido_em,
      categoria: 'anomalia',
      rotulo: `Sentinela [${a.severidade}]: ${a.invariante}${a.resolvido_em ? ' (resolvida)' : ''}`,
      detalhe: `esperado: ${a.esperado} — encontrado: ${a.encontrado}`,
      conta: false,
      destino: '/painel/central',
    });
  }

  return passos.sort((a, b) => a.quando.localeCompare(b.quando));
}
