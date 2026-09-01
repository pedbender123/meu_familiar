import { randomUUID } from 'crypto';
import db from '../lib/db';
import { buscarPlano, type Plano } from './planos';
import { criarAssinatura, type Assinatura } from './assinaturas';
import { ehPlanoDaOferta } from './oferta';
import { registrarInicioDeCheckout } from './eventos-meta';
import { planosVendaveis } from '../lib/modelo-de-venda';

export interface Cobranca {
  id: string;
  conta_id: string;
  email: string;
  plano_id: string;
  valor_centavos: number;
  status: 'aguardando_pagamento' | 'pago' | 'cancelado';
  pagamento_id: string | null;
  metodo: string | null;
  bruto_centavos: number | null;
  taxa_centavos: number | null;
  liquido_centavos: number | null;
  assinatura_id: string | null;
  /**
   * O contrato de recorrência do lado do gateway (migração 035).
   *
   * `null` em toda cobrança avulsa e em tudo que é anterior à recorrência.
   * É por ele que a cobrança do mês seguinte se reencontra — ela chega com
   * transação nova e identificador que não é nosso.
   */
  assinatura_externa_id: string | null;
  proxima_cobranca_em: string | null;
  pago_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Abre uma cobrança para um plano.
 *
 * O valor vem do PLANO, lido do banco no servidor — nunca do cliente. É a
 * mesma regra de `montarCorpo`: preço que passa pelo navegador é preço
 * editável, e aqui não há nem cupom pra justificar exceção.
 */
export function abrirCobranca(dados: {
  contaId: string;
  email: string;
  planoId: string;
  /**
   * De onde veio a intenção de comprar.
   *
   * `vitrine` (o padrão) só deixa passar plano público: é o que impede que um
   * link direto venda um plano que não está à venda para todo mundo — anual,
   * avulso antigo, cortesia.
   *
   * `oferta` abre a exceção para a escada de depois do ritual, cujas duas
   * avulsas existem justamente **fora** da vitrine (ver `nucleo/oferta.ts`).
   * A exceção é estreita de propósito: só os ids daquela lista, nunca
   * "qualquer plano não-público".
   */
  origem?: 'vitrine' | 'oferta';
}): { cobranca: Cobranca; plano: Plano } | null {
  /**
   * A trava de emergência, e só ela.
   *
   * Antes aqui estava `if (!modeloNovoLigado()) return null` — a venda de
   * plano dependia do interruptor do modelo de venda. Com ele desligado,
   * `/planos` anunciava três planos com preço e clicar em qualquer um dava
   * "plano indisponível". A vitrine ficou aberta e a porta trancada por
   * semanas, sem uma única cobrança de plano no banco.
   *
   * Amarrar as duas coisas na mesma chave significava que vender plano custava
   * zerar o preço da Revelação, que é o que a campanha vende. Agora são
   * chaves separadas: `planos_fechados` tranca só isto.
   *
   * Os filtros que importam vêm logo abaixo e sempre estiveram certos: só
   * plano `publico` (ou liberado pela oferta), `ativo`, e com preço.
   */
  if (!planosVendaveis()) return null;

  const plano = buscarPlano(dados.planoId);
  if (!plano || !plano.ativo) return null;

  const liberadoPelaOferta = dados.origem === 'oferta' && ehPlanoDaOferta(plano.id);
  if (!plano.publico && !liberadoPelaOferta) return null;
  // Plano grátis não gera cobrança: quem tentar assinar o gratuito por aqui
  // está no caminho errado, e criar uma cobrança de R$ 0,00 só produziria uma
  // linha que o gateway recusaria depois.
  if (plano.preco_centavos <= 0) return null;

  const agora = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO cobrancas
       (id, conta_id, email, plano_id, valor_centavos, status, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, 'aguardando_pagamento', ?, ?)`
  ).run(id, dados.contaId, dados.email.trim().toLowerCase(), plano.id, plano.preco_centavos, agora, agora);

  /**
   * A intenção de pagar nasce AQUI, e é aqui que ela é contada.
   *
   * No navegador o `InitiateCheckout` dependia da tela de pagamento montar:
   * sumia para quem tem bloqueador e contava de novo a cada recarga. Este
   * ponto acontece uma vez, quando a cobrança passa a existir.
   */
  try {
    registrarInicioDeCheckout({
      referencia: id,
      email: dados.email,
      valorEmReais: plano.preco_centavos / 100,
    });
  } catch (erro) {
    // Rastreio nunca derruba uma cobrança.
    console.error('[cobrancas] InitiateCheckout falhou:', erro);
  }

  return { cobranca: buscarCobranca(id)!, plano };
}

export function buscarCobranca(id: string): Cobranca | undefined {
  return db.prepare('SELECT * FROM cobrancas WHERE id = ?').get(id) as Cobranca | undefined;
}

export function buscarCobrancaPorPagamento(pagamentoId: string): Cobranca | undefined {
  return db
    .prepare('SELECT * FROM cobrancas WHERE pagamento_id = ?')
    .get(pagamentoId) as Cobranca | undefined;
}

export function anotarPagamento(id: string, pagamentoId: string): void {
  db.prepare(
    `UPDATE cobrancas SET pagamento_id = ?, atualizado_em = ? WHERE id = ?`
  ).run(pagamentoId, new Date().toISOString(), id);
}

/**
 * Guarda o contrato de recorrência criado no gateway.
 *
 * Gravado no INSTANTE em que a Wiven responde, antes de qualquer entrega:
 * sem o id não há como cancelar, e uma assinatura recorrente que ninguém
 * consegue parar cobra a pessoa todos os meses até alguém abrir um chamado no
 * suporte do gateway.
 */
export function anotarAssinaturaExterna(
  id: string,
  externa: { id: string; proximaCobrancaEm: string | null }
): void {
  db.prepare(
    `UPDATE cobrancas
        SET assinatura_externa_id = ?, proxima_cobranca_em = ?, atualizado_em = ?
      WHERE id = ?`
  ).run(externa.id, externa.proximaCobrancaEm, new Date().toISOString(), id);
}

/**
 * Confirma a cobrança e cria a assinatura.
 *
 * **Idempotente**, e tem que ser: o webhook do Mercado Pago reenvia a mesma
 * notificação quando não recebe 200 rápido o bastante, e a segunda passagem
 * não pode dar um segundo mês de plano a ninguém. A trava é o `status` já
 * `pago` — checado e escrito na mesma transação.
 *
 * O `fim` sai do `duracao_dias` do plano (ver `criarAssinatura`), então
 * renovar é simplesmente pagar de novo: nasce outra assinatura com outro
 * prazo, e `direitosEfetivos` une as duas.
 */
export function confirmarPagamento(
  id: string,
  detalhes: {
    metodo?: string | null;
    brutoCentavos?: number | null;
    taxaCentavos?: number | null;
    liquidoCentavos?: number | null;
  } = {}
): { cobranca: Cobranca; assinatura: Assinatura | null } | null {
  const agora = new Date();

  const transacao = db.transaction(() => {
    const cobranca = buscarCobranca(id);
    if (!cobranca) return null;

    // Já confirmada: devolve o que existe, sem criar nada de novo.
    if (cobranca.status === 'pago') {
      return {
        cobranca,
        assinatura: cobranca.assinatura_id
          ? (db
              .prepare('SELECT * FROM assinaturas WHERE id = ?')
              .get(cobranca.assinatura_id) as Assinatura)
          : null,
      };
    }

    const assinatura = criarAssinatura({
      contaId: cobranca.conta_id,
      planoId: cobranca.plano_id,
      inicio: agora,
    });

    db.prepare(
      `UPDATE cobrancas SET
         status = 'pago', pago_em = @agora, atualizado_em = @agora,
         assinatura_id = @assinatura, metodo = COALESCE(@metodo, metodo),
         bruto_centavos = COALESCE(@bruto, bruto_centavos),
         taxa_centavos = COALESCE(@taxa, taxa_centavos),
         liquido_centavos = COALESCE(@liquido, liquido_centavos)
       WHERE id = @id`
    ).run({
      id,
      agora: agora.toISOString(),
      assinatura: assinatura?.id ?? null,
      metodo: detalhes.metodo ?? null,
      bruto: detalhes.brutoCentavos ?? null,
      taxa: detalhes.taxaCentavos ?? null,
      liquido: detalhes.liquidoCentavos ?? null,
    });

    return { cobranca: buscarCobranca(id)!, assinatura };
  });

  return transacao();
}

export function cobrancasDaConta(contaId: string): Cobranca[] {
  return db
    .prepare('SELECT * FROM cobrancas WHERE conta_id = ? ORDER BY criado_em DESC')
    .all(contaId) as Cobranca[];
}

/* ── renovação de assinatura recorrente ───────────────────────────────────*/

/**
 * A cobrança cujo contrato de assinatura aparece neste identificador.
 *
 * ── Por que `LIKE`, e não igualdade ───────────────────────────────────────
 *
 * A renovação chega com um `identifier` que **não é o nosso**. Medido na
 * primeira assinatura real:
 *
 *     app.wiven.com.br-SUBSCRIPTION-cmti85x190wnq01q0xbi9dbcv-cmti85x1r0wns01q006r6qguc
 *
 * O último pedaço é o id da assinatura, que a gente guardou na criação. Casar
 * por "o identificador CONTÉM um contrato que eu conheço" não depende do
 * formato dessa string — e depender do formato de um identificador que o
 * gateway monta é apostar que ele nunca vai mudar.
 */
export function cobrancaDoContrato(identificador: string | null | undefined): Cobranca | undefined {
  const bruto = (identificador ?? '').trim();
  if (bruto.length < 8) return undefined;

  return db
    .prepare(
      `SELECT * FROM cobrancas
        WHERE assinatura_externa_id IS NOT NULL
          AND ? LIKE '%' || assinatura_externa_id || '%'
        ORDER BY criado_em DESC LIMIT 1`
    )
    .get(bruto) as Cobranca | undefined;
}

/**
 * Empurra o fim da assinatura para frente — a renovação que a Wiven cobrou.
 *
 * ── Por que não é `confirmarPagamento` de novo ────────────────────────────
 *
 * Aquela função é idempotente de propósito: cobrança já `pago` devolve o que
 * existe e não cria nada. É o que impede o webhook reenviado de dar dois
 * meses a quem pagou um.
 *
 * Só que a RENOVAÇÃO é o caso oposto: mesma cobrança, mês novo, dinheiro novo.
 * Passar por lá faria a renovação não fazer nada — e o acesso venceria no dia
 * seguinte, com o cliente pagando em dia. Silenciosamente.
 *
 * ── A partir de onde conta ────────────────────────────────────────────────
 *
 * Do `fim` atual, não de hoje. Quem paga a renovação com dois dias de
 * antecedência não pode perder esses dois dias — e quem paga atrasado começa
 * o ciclo novo agora, porque contar de um `fim` já vencido daria menos tempo
 * do que o pago.
 */
export function renovarAssinatura(
  contratoExterno: string,
  duracaoDias: number,
  agora = new Date()
): { id: string; fim: string } | null {
  const assinatura = db
    .prepare(
      `SELECT * FROM assinaturas
        WHERE assinatura_externa_id = ? AND status IN ('ativa', 'expirada')
        ORDER BY criado_em DESC LIMIT 1`
    )
    .get(contratoExterno) as { id: string; fim: string | null } | undefined;

  if (!assinatura) return null;

  const base = assinatura.fim && Date.parse(assinatura.fim) > agora.getTime()
    ? new Date(assinatura.fim)
    : agora;
  const fim = new Date(base.getTime() + duracaoDias * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    `UPDATE assinaturas SET fim = ?, status = 'ativa', atualizado_em = ? WHERE id = ?`
  ).run(fim, agora.toISOString(), assinatura.id);

  return { id: assinatura.id, fim };
}

/** Liga a assinatura ao contrato do gateway, para a renovação achar as duas. */
export function ligarAssinaturaAoContrato(assinaturaId: string, contratoExterno: string): void {
  db.prepare(`UPDATE assinaturas SET assinatura_externa_id = ? WHERE id = ?`).run(
    contratoExterno,
    assinaturaId
  );
}
