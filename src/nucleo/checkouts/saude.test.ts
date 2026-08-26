import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUARENTENA_MS,
  ehIndisponibilidade,
  estaDisponivel,
  limparSaude,
  marcarIndisponivel,
  segundosAteVoltar,
} from './saude';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

beforeEach(() => limparSaude());

describe('o disjuntor do gateway', () => {
  /**
   * 24/08: a Wiven passou a responder 403 com página de desafio do
   * Cloudflare, de todos os IPs — inclusive o que estava na lista de
   * autorizados dela. O checkout inteiro teria parado, sem erro legível, e
   * ninguém saberia até alguém reclamar que não consegue pagar.
   */
  test('tudo começa de pé', () => {
    assert.equal(estaDisponivel('wiven'), true);
    assert.equal(segundosAteVoltar('wiven'), null);
  });

  test('uma falha derruba pela quarentena inteira', () => {
    const agora = Date.now();
    marcarIndisponivel('wiven', 'HTTP 403');
    assert.equal(estaDisponivel('wiven', agora), false);
    assert.equal(estaDisponivel('wiven', agora + QUARENTENA_MS - 1000), false);
  });

  /** Vencida a quarentena, a próxima cobrança testa de novo, de verdade. */
  test('a quarentena vence sozinha', () => {
    const agora = Date.now();
    marcarIndisponivel('wiven', 'HTTP 403');
    assert.equal(estaDisponivel('wiven', agora + QUARENTENA_MS + 1), true);
  });

  test('derrubar um gateway não derruba o outro', () => {
    marcarIndisponivel('wiven', 'HTTP 403');
    assert.equal(estaDisponivel('cakto'), true);
    assert.equal(estaDisponivel('mercadopago'), true);
  });
});

describe('o que conta como indisponibilidade', () => {
  /**
   * A distinção que evita o pior erro possível: derrubar um gateway que está
   * funcionando porque alguém digitou o cartão errado.
   */
  test('falha de infraestrutura derruba', () => {
    for (const s of [401, 403, 429, 500, 502, 503]) {
      assert.equal(ehIndisponibilidade(s), true, `HTTP ${s}`);
    }
  });

  test('resposta de negócio não derruba', () => {
    for (const s of [400, 402, 404, 409, 422]) {
      assert.equal(ehIndisponibilidade(s), false, `HTTP ${s}`);
    }
  });
});

describe('a tela seguinte já nasce no gateway certo', () => {
  test('o roteador ignora gateway em quarentena', () => {
    const fonte = codigoDe('src/nucleo/checkouts/gateway.ts');
    assert.match(fonte, /escolhido !== 'mercadopago' && !estaDisponivel\(escolhido\)/);
  });

  /**
   * É o que resolve o CARTÃO. O Brick tokeniza no navegador e o token de um
   * gateway não vale no outro — não há queda possível no meio da cobrança.
   * Um formulário que já nasce no gateway certo não precisa de queda.
   */
  test('o Mercado Pago nunca entra em quarentena por esta regra', () => {
    const fonte = codigoDe('src/nucleo/checkouts/gateway.ts');
    assert.match(fonte, /escolhido !== 'mercadopago'/);
  });
});

describe('a queda no meio da cobrança é restrita', () => {
  const fonte = codigoDe('src/app/api/pedido/[id]/pagamento/route.ts');

  /**
   * Só Pix, e só quando a cobrança COM CERTEZA não foi criada. Tempo esgotado
   * não entra: ali a resposta se perdeu e a cobrança pode existir do outro
   * lado — tentar de novo cobraria a mesma pessoa duas vezes.
   */
  test('cai só no Pix, e só no erro que garante que nada foi criado', () => {
    assert.match(fonte, /erro instanceof ErroDeGatewayIndisponivel/);
    assert.match(fonte, /meio === 'pix'/);
    assert.match(fonte, /nomeDoGateway !== 'mercadopago'/);
    assert.match(fonte, /if \(!podeCair\) throw erro;/);
  });

  /** O painel precisa saber a quem pedir estorno. */
  test('o gateway que realmente cobrou fica gravado', () => {
    assert.match(fonte, /atualizarPedido\(id, \{ gateway: 'mercadopago' \}\)/);
  });

  test('tempo esgotado não vira erro recuperável', () => {
    const w = codigoDe('src/nucleo/checkouts/wiven.ts');
    assert.match(w, /TimeoutError' \|\| erro\.name === 'AbortError'/);
    assert.match(w, /a cobrança pode ter sido criada/);
  });
});

describe('a sonda antes de desenhar a tela', () => {
  const fonteW = codigoDe('src/nucleo/checkouts/wiven.ts');
  const fonteG = codigoDe('src/nucleo/checkouts/gateway.ts');

  /**
   * O disjuntor é reativo: só derruba a chave depois de alguém tentar pagar e
   * falhar. Quem chega primeiro depois de uma queda paga o pato — vê um
   * checkout que não cobra. Em 24/08 a Wiven passou 26 horas fora; sem sonda,
   * seriam 26 horas de checkout quebrado.
   */
  test('a tela de pagamento sonda antes de escolher', () => {
    assert.match(fonteG, /export async function gatewayConferido/);
    assert.match(fonteG, /if \(gatewayDe\(meio, campanhaId\) === 'wiven'\) await sondarWiven\(\)/);
  });

  /**
   * Sondar primeiro e resolver depois. Resolver antes usaria a informação
   * velha — justamente a que a sonda existe para substituir.
   */
  test('a decisão é refeita depois da sonda', () => {
    const i = fonteG.indexOf('await sondarWiven()');
    const j = fonteG.indexOf('return gatewayDe(meio, campanhaId);', i);
    assert.ok(i !== -1 && j > i, 'gatewayDe precisa ser reavaliado depois da sonda');
  });

  /**
   * Sem cache, cada visita ao checkout viraria uma chamada extra à API deles
   * — e foi excesso de chamada que disparou a proteção antiautomação em
   * 24/08. Uma por minuto nunca vira rajada, por mais movimento que venha.
   */
  test('no máximo uma sonda por minuto', () => {
    assert.match(fonteW, /agora - sondadaEm < VALIDADE_DA_SONDA_MS\) return;/);
  });

  /** Sonda que derruba a tela de pagamento é pior que gateway fora do ar. */
  test('a sonda nunca lança', () => {
    const i = fonteW.indexOf('export async function sondarWiven');
    const trecho = fonteW.slice(i, fonteW.indexOf('export function esquecerSonda'));
    assert.match(trecho, /catch \(erro\)/);
    assert.doesNotMatch(trecho, /throw /);
  });

  /**
   * O bloqueio de 24/08 voltava 403, mas desafio de Cloudflare também vem
   * como 200 com HTML. Confiar só no código de status deixaria a sonda dizer
   * "está tudo bem" enquanto a cobrança quebra no parse.
   */
  test('200 que não é JSON também conta como fora', () => {
    assert.match(fonteW, /sonda: resposta não é JSON/);
  });

  /** A cobrança não sonda: ali seria uma chamada a mais entre a pessoa e o pagamento. */
  test('a rota de cobrança continua síncrona', () => {
    const rota = codigoDe('src/app/api/pedido/[id]/pagamento/route.ts');
    assert.doesNotMatch(rota, /gatewayConferido/);
    assert.match(rota, /gatewayDe\(meio, pedido\.campanha_id\)/);
  });
});
