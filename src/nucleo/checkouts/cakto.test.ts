import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarCorpo,
  traduzir,
  traduzirStatus,
  emCentavos,
  obterToken,
  esquecerToken,
  garantirOferta,
  ProvedorCakto,
  type DadosCriacaoCakto,
} from './cakto';
import { esquecerOferta, ofertaGravada } from './cakto-ofertas';
import { PRODUTOS } from '../../lib/produtos';

/**
 * O adaptador da Cakto.
 *
 * ── O que estes testes existem para pegar ─────────────────────────────────
 *
 * A Cakto **não tem sandbox**. Não há ambiente onde errar de graça: a primeira
 * chamada real já cobra alguém. Então tudo que dá para provar sem rede está
 * provado aqui — em especial as três coisas que erram em silêncio:
 *
 *   1. o `sck`, que é o único vínculo entre a cobrança e o nosso pedido
 *   2. o preço, que agora vem de uma oferta cadastrada lá fora
 *   3. a tradução de status, que decide quem recebe o que comprou
 */

const CAKTO_DO_FRONT = {
  metodo: 'pix' as const,
  nome: 'Maria Souza',
  telefone: '(11) 99999-9999',
  fingerprint: 'fp_abc',
  docNumber: '123.456.789-09',
};

function dados(over: Partial<DadosCriacaoCakto> = {}): DadosCriacaoCakto {
  return {
    form: { payment_method_id: 'pix' },
    produto: PRODUTOS.completa,
    pedidoId: 'pedido-123',
    emailDoPedido: 'maria@exemplo.com',
    descontoPercentual: 0,
    cakto: CAKTO_DO_FRONT,
    ...over,
  } as DadosCriacaoCakto;
}

/* ── o corpo da cobrança ──────────────────────────────────────────────────*/

describe('montarCorpo', () => {
  test('o pedidoId viaja no sck — é o nosso external_reference', () => {
    const corpo = montarCorpo(dados(), 'oferta-x');
    const metadata = corpo.metadata as Record<string, unknown>;
    assert.equal(
      metadata.sck,
      'pedido-123',
      'sem sck, uma notificação que chegue antes da gravação deixa o pagamento órfão'
    );
  });

  test('manda exatamente um item, com o offerId que veio resolvido', () => {
    const corpo = montarCorpo(dados(), 'oferta-x');
    assert.deepEqual(corpo.items, [{ offerId: 'oferta-x', quantity: 1, offerType: 'main' }]);
  });

  test('o telefone vai só com dígitos, como a Cakto pede em E.164', () => {
    const corpo = montarCorpo(dados(), 'o');
    const customer = corpo.customer as Record<string, unknown>;
    assert.equal(customer.phone, '11999999999');
    assert.equal(customer.docNumber, '12345678909');
    assert.equal(customer.docType, 'cpf');
  });

  /**
   * Pedido do funil de anúncio pode nascer sem e-mail, e a Cakto recusa a
   * cobrança sem um. Nunca `example.com`: motor de risco marca como suspeito.
   */
  test('pedido sem e-mail ganha um endereço nosso, único por pedido', () => {
    const corpo = montarCorpo(dados({ emailDoPedido: '' }), 'o');
    const customer = corpo.customer as Record<string, unknown>;
    assert.equal(customer.email, 'pedido+pedido-123@bruxario.com.br');
  });

  test('Pix não leva cartão nem antifraude, e pede expiração', () => {
    const corpo = montarCorpo(dados(), 'o');
    assert.equal(corpo.pixExpiresIn, 3600);
    assert.ok(!('card' in corpo));
    assert.ok(!('antifraudProfilingAttemptReference' in corpo));
  });

  test('cartão leva token e a referência do antifraude, que é obrigatória', () => {
    const corpo = montarCorpo(
      dados({
        cakto: {
          ...CAKTO_DO_FRONT,
          metodo: 'credit_card',
          cardToken: 'tok_1',
          antifraudReference: 'af_1',
        },
      }),
      'o'
    );
    assert.deepEqual(corpo.card, { token: 'tok_1' });
    assert.equal(corpo.antifraudProfilingAttemptReference, 'af_1');
  });

  test('3DS leva também os campos da autenticação do banco', () => {
    const corpo = montarCorpo(
      dados({
        cakto: {
          ...CAKTO_DO_FRONT,
          metodo: 'threeDs',
          cardToken: 'tok_1',
          antifraudReference: 'af_1',
          threeDSecure: { cavv: 'c', eci: '05', version: '2.2.0' },
        },
      }),
      'o'
    );
    assert.deepEqual(corpo.threeDSecure, { cavv: 'c', eci: '05', version: '2.2.0' });
  });

  /**
   * `metadata` da Cakto tem seis campos fixos e nada mais. Mandar chave que
   * ela não conhece é pedir 400 numa cobrança que ia dar certo.
   */
  /**
   * A API da Cakto não tem endpoint de cupom: ele é cadastrado no painel deles
   * e a gente só repassa o código. Se ele não viajasse, o comprador pagaria o
   * preço cheio depois de ver o com desconto na tela.
   */
  test('o cupom viaja pelo código, que é quem a Cakto conhece', () => {
    const corpo = montarCorpo(
      dados({ cakto: { ...CAKTO_DO_FRONT, cupomCodigo: 'BRUXA20' } }),
      'o'
    );
    assert.equal(corpo.coupon, 'BRUXA20');
  });

  test('sem cupom, o campo nem aparece no corpo', () => {
    const corpo = montarCorpo(dados(), 'o');
    assert.ok(!('coupon' in corpo));
  });

  test('só as cinco UTMs conhecidas passam; o resto é descartado', () => {
    const corpo = montarCorpo(
      dados({
        cakto: {
          ...CAKTO_DO_FRONT,
          utm: { utm_source: 'fb', utm_campaign: 'a1', gclid: 'xxx', qualquer: 'y' },
        },
      }),
      'o'
    );
    const metadata = corpo.metadata as Record<string, unknown>;
    assert.equal(metadata.utm_source, 'fb');
    assert.equal(metadata.utm_campaign, 'a1');
    assert.ok(!('gclid' in metadata));
    assert.ok(!('qualquer' in metadata));
    assert.equal(metadata.sck, 'pedido-123', 'o sck sobrevive à filtragem das UTMs');
  });
});

/* ── tradução ─────────────────────────────────────────────────────────────*/

describe('tradução para o vocabulário do sistema', () => {
  /**
   * O resto do projeto fala `approved` desde o Asaas. Se `paid` vazasse sem
   * tradução, `statusLiberaAcesso` diria não e ninguém receberia o que pagou.
   */
  test('paid vira approved — é o único que libera acesso', () => {
    assert.equal(traduzirStatus('paid'), 'approved');
  });

  test('Pix nasce pendente, e pendente não libera nada', () => {
    assert.equal(traduzirStatus('waiting_payment'), 'pending');
  });

  test('as duas recusas da Cakto viram a nossa', () => {
    assert.equal(traduzirStatus('declined'), 'rejected');
    assert.equal(traduzirStatus('refused'), 'rejected');
  });

  test('status desconhecido passa cru em vez de virar approved por acidente', () => {
    assert.equal(traduzirStatus('coisa_nova'), 'coisa_nova');
    assert.equal(traduzirStatus(undefined), 'unknown');
  });

  test('reais em string viram centavos inteiros, sem erro de float', () => {
    assert.equal(emCentavos('9.80'), 980);
    assert.equal(emCentavos(18.9), 1890);
    assert.equal(emCentavos(null), null);
    assert.equal(emCentavos(''), null);
  });

  test('o líquido é bruto menos taxa', () => {
    const r = traduzir({ id: 'o1', status: 'paid', amount: '12.80', fees: '2.49' });
    assert.equal(r.brutoCentavos, 1280);
    assert.equal(r.taxaCentavos, 249);
    assert.equal(r.liquidoCentavos, 1031);
  });

  /**
   * `fees` não vem na resposta da criação do cartão — só no GET do pedido.
   * Chutar o líquido aí viraria lucro imaginário no painel.
   */
  test('sem taxa informada, o líquido é null e não um chute', () => {
    const r = traduzir({ id: 'o1', status: 'paid', amount: '12.80' });
    assert.equal(r.taxaCentavos, null);
    assert.equal(r.liquidoCentavos, null);
  });

  test('o sck volta como referenciaExterna, que é como o webhook acha o pedido', () => {
    const r = traduzir({ id: 'o1', status: 'paid', sck: 'pedido-123' });
    assert.equal(r.referenciaExterna, 'pedido-123');
  });

  test('o Pix traz o copia-e-cola', () => {
    const r = traduzir({
      id: 'o1',
      status: 'waiting_payment',
      pix: { qrCode: '00020126...', qrCodeBase64: 'iVBOR' },
    });
    assert.equal(r.pix?.copiaECola, '00020126...');
  });
});

/* ── rede dublada ─────────────────────────────────────────────────────────*/

const fetchReal = globalThis.fetch;
let chamadas: { url: string; init: RequestInit }[] = [];

function dublarFetch(respostas: (() => Response)[]) {
  chamadas = [];
  let i = 0;
  globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    chamadas.push({ url: String(url), init });
    const proxima = respostas[Math.min(i++, respostas.length - 1)];
    return proxima();
  }) as typeof fetch;
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  globalThis.fetch = fetchReal;
  esquecerToken();
});

describe('token', () => {
  beforeEach(() => {
    esquecerToken();
    process.env.CAKTO_CLIENT_ID = 'id';
    process.env.CAKTO_CLIENT_SECRET = 'segredo';
  });

  /**
   * Não existe endpoint de renovação na Cakto, e são 120 req/min por token.
   * Pedir um token por cobrança gastaria o orçamento com autenticação.
   */
  test('o token é reaproveitado enquanto vale — não pede um por cobrança', async () => {
    dublarFetch([() => json({ access_token: 'tok', expires_in: 36000 })]);

    assert.equal(await obterToken(), 'tok');
    assert.equal(await obterToken(), 'tok');
    assert.equal(chamadas.length, 1, 'a segunda chamada saiu do cache');
  });

  /**
   * A margem de 60s existe para o token não vencer NO MEIO da requisição —
   * um 401 aí chega como falha de cobrança para quem está com o cartão na mão.
   */
  test('renova antes de vencer, não depois', async () => {
    dublarFetch([
      () => json({ access_token: 'tok1', expires_in: 120 }),
      () => json({ access_token: 'tok2', expires_in: 120 }),
    ]);

    const t0 = Date.now();
    assert.equal(await obterToken(t0), 'tok1');
    // 70s depois: o token só vence aos 120s, mas a margem já o considera velho.
    assert.equal(await obterToken(t0 + 70_000), 'tok2');
  });

  test('sem credencial, falha alto em vez de tentar cobrar sem token', async () => {
    delete process.env.CAKTO_CLIENT_ID;
    await assert.rejects(() => obterToken(), /CAKTO_CLIENT_ID/);
  });
});

describe('ofertas', () => {
  beforeEach(() => {
    esquecerToken();
    process.env.CAKTO_CLIENT_ID = 'id';
    process.env.CAKTO_CLIENT_SECRET = 'segredo';
    process.env.CAKTO_PRODUTO_ID = 'prod-1';
    esquecerOferta('completa', 1512);
    esquecerOferta('completa', 1890);
  });

  /**
   * A API da Cakto não cobra valores, cobra ofertas. Isto é o que impede o
   * preço de virar um cadastro manual no painel deles.
   */
  /**
   * A oferta é a do preço CHEIO. Quem desconta é o cupom cadastrado na Cakto —
   * duas fontes de verdade para o mesmo abatimento é como se cobra errado.
   */
  test('a cobrança usa a oferta do preço cheio, mesmo com desconto no pedido', async () => {
    esquecerOferta('completa', 1890);
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ id: 'oferta-cheia' }, 201),
      () => json({ id: 'o1', status: 'paid', amount: '15.12', fees: '2.49' }, 201),
    ]);

    await new ProvedorCakto().criarPagamento(
      dados({ descontoPercentual: 20, cakto: { ...CAKTO_DO_FRONT, cupomCodigo: 'BRUXA20' } })
    );

    const criacaoDaOferta = chamadas.find((c) => c.url.includes('/offers/'));
    assert.equal(
      JSON.parse(String(criacaoDaOferta?.init.body)).price,
      18.9,
      'a oferta é a de tabela; o desconto é do cupom deles'
    );

    const cobranca = chamadas.find((c) => c.url.includes('/payments/'));
    assert.equal(JSON.parse(String(cobranca?.init.body)).coupon, 'BRUXA20');
  });

  test('preço sem oferta conhecida cria a oferta e guarda o id', async () => {
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ id: 'oferta-nova' }, 201),
    ]);

    const id = await garantirOferta(PRODUTOS.completa, 1512);
    assert.equal(id, 'oferta-nova');
    assert.equal(ofertaGravada('completa', 1512), 'oferta-nova');

    const criacao = chamadas.find((c) => c.url.includes('/offers/'));
    const corpo = JSON.parse(String(criacao?.init.body));
    assert.equal(corpo.price, 15.12, 'a Cakto fala em reais; nós, em centavos');
    assert.equal(corpo.product, 'prod-1');
    assert.equal(corpo.status, 'active');
  });

  test('o preço já conhecido não cria oferta de novo', async () => {
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ id: 'oferta-1' }, 201),
    ]);
    await garantirOferta(PRODUTOS.completa, 1890);

    dublarFetch([() => json({}, 500)]);
    assert.equal(await garantirOferta(PRODUTOS.completa, 1890), 'oferta-1');
    assert.equal(chamadas.length, 0, 'nem tocou na rede');
  });

  test('o nome da oferta carrega o valor, senão o painel vira uma lista de iguais', async () => {
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ id: 'o' }, 201),
    ]);
    await garantirOferta(PRODUTOS.completa, 1512);
    const corpo = JSON.parse(String(chamadas.find((c) => c.url.includes('/offers/'))?.init.body));
    assert.match(corpo.name, /R\$ 15,12/);
  });
});

describe('reconciliação', () => {
  beforeEach(() => {
    esquecerToken();
    process.env.CAKTO_CLIENT_ID = 'id';
    process.env.CAKTO_CLIENT_SECRET = 'segredo';
  });

  /**
   * `GET /orders/` não aceita filtro de data — só `limit` e `page`. Então a
   * janela é aplicada aqui, e a paginação precisa parar sozinha ao passar dela.
   */
  test('para de paginar assim que passa da janela', async () => {
    const dentro = { id: 'a', status: 'paid', paidAt: '2026-08-20T12:00:00-03:00', sck: 'p1' };
    const fora = { id: 'b', status: 'paid', paidAt: '2026-01-01T12:00:00-03:00', sck: 'p2' };

    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ results: [dentro, fora], next: 'tem-mais' }),
    ]);

    const pagos = await new ProvedorCakto().listarPagosNoPeriodo(
      new Date('2026-08-01'),
      new Date('2026-08-31')
    );

    assert.deepEqual(
      pagos.map((p) => p.referenciaExterna),
      ['p1']
    );
    const paginas = chamadas.filter((c) => c.url.includes('/orders/'));
    assert.equal(paginas.length, 1, 'não pediu a página seguinte depois de passar da janela');
  });

  test('erro na listagem devolve vazio — reconciliação tenta de novo amanhã', async () => {
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ detail: 'boom' }, 500),
    ]);
    const pagos = await new ProvedorCakto().listarPagosNoPeriodo(new Date(0), new Date());
    assert.deepEqual(pagos, []);
  });
});

describe('estorno', () => {
  beforeEach(() => {
    esquecerToken();
    process.env.CAKTO_CLIENT_ID = 'id';
    process.env.CAKTO_CLIENT_SECRET = 'segredo';
  });

  /** Quem chama é uma tela de painel: precisa do motivo, não de um 500. */
  test('a recusa volta com o motivo em português, sem lançar', async () => {
    dublarFetch([
      () => json({ access_token: 'tok', expires_in: 3600 }),
      () => json({ detail: 'Pedido já reembolsado' }, 400),
    ]);
    const r = await new ProvedorCakto().estornar('o1');
    assert.deepEqual(r, { ok: false, erro: 'Pedido já reembolsado' });
  });
});
