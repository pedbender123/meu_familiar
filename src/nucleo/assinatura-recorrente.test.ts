import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { periodicidadeDe } from './checkouts/wiven';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a periodicidade', () => {
  /**
   * 30 dias vira 1 MONTHS, e não 30 DAYS.
   *
   * `MONTHS` acompanha o calendário. Com `DAYS`, a data da cobrança anda para
   * trás todo mês e em um ano a pessoa é cobrada **treze vezes** — uma a mais
   * do que contratou, e ela vai perceber no extrato antes de a gente perceber
   * no código.
   */
  test('mês é mês, não trinta dias', () => {
    assert.deepEqual(periodicidadeDe(30), { tipo: 'MONTHS', quantidade: 1 });
  });

  test('ano é ano', () => {
    assert.deepEqual(periodicidadeDe(365), { tipo: 'YEARS', quantidade: 1 });
  });

  test('múltiplos caem no período maior que couber', () => {
    assert.deepEqual(periodicidadeDe(90), { tipo: 'MONTHS', quantidade: 3 });
    assert.deepEqual(periodicidadeDe(14), { tipo: 'WEEKS', quantidade: 2 });
    assert.deepEqual(periodicidadeDe(10), { tipo: 'DAYS', quantidade: 10 });
  });

  /** Plano sem prazo é acesso permanente; nunca deveria virar recorrência. */
  test('sem duração cai no mensal, sem quebrar', () => {
    assert.deepEqual(periodicidadeDe(null), { tipo: 'MONTHS', quantidade: 1 });
    assert.deepEqual(periodicidadeDe(0), { tipo: 'MONTHS', quantidade: 1 });
  });
});

describe('a criação da assinatura', () => {
  const fonte = codigoDe('src/nucleo/checkouts/wiven.ts');

  test('usa as rotas de assinatura, não as de cobrança avulsa', () => {
    assert.match(fonte, /'\/gateway\/pix\/subscription'/);
    assert.match(fonte, /'\/gateway\/card\/subscription'/);
  });

  /**
   * A documentação dos dois endpoints de assinatura não lista `splits`. Campo
   * que o gateway não conhece é convite para INVALID_INPUT recusar a cobrança
   * inteira — e uma assinatura recusada é um cliente perdido na tela de pagar.
   */
  test('não manda splits, que não existe nestas rotas', () => {
    const bloco = fonte.slice(fonte.indexOf('export async function criarAssinaturaWiven'));
    assert.doesNotMatch(bloco, /splits/);
  });

  /** `OK` na criação quer dizer "a cobrança nasceu", não "o dinheiro entrou". */
  test('reaproveita o tradutor, que sabe que OK não é pago', () => {
    const bloco = fonte.slice(fonte.indexOf('export async function criarAssinaturaWiven'));
    assert.match(bloco, /traduzir\(bruta/);
  });

  /**
   * Tempo esgotado numa assinatura é pior que numa cobrança: se ela nasceu do
   * outro lado, existe um contrato recorrente que o nosso banco não conhece —
   * e ele cobra todo mês.
   */
  test('tempo esgotado nunca vira gateway indisponível', () => {
    const bloco = fonte.slice(fonte.indexOf('export async function criarAssinaturaWiven'));
    assert.match(bloco, /a assinatura pode ter sido criada/);
  });
});

describe('a rota de cobrança', () => {
  const rota = codigoDe('src/app/api/cobranca/[id]/pagamento/route.ts');

  test('só usa recorrência em plano recorrente, e só na Wiven', () => {
    assert.match(rota, /plano\.recorrente === 1 && nomeDoGateway === 'wiven'/);
  });

  /**
   * Cair para outro gateway numa assinatura criaria um contrato mensal em
   * cada um — e dois contratos ativos cobram a mesma pessoa duas vezes, todo
   * mês, até alguém reparar no extrato.
   */
  test('assinatura recorrente não cai para o Mercado Pago', () => {
    assert.match(rota, /!recorrente &&/);
  });

  /**
   * Sem o id não há como cancelar. Gravar depois de responder deixaria uma
   * janela em que o contrato existe lá e a gente não sabe qual é.
   */
  test('grava o contrato antes de responder à tela', () => {
    const i = rota.indexOf('anotarAssinaturaExterna');
    const j = rota.indexOf('return NextResponse.json({\n      status: resultado.status');
    assert.ok(i > 0, 'o contrato precisa ser gravado');
    assert.ok(j === -1 || i < j, 'gravar tem que vir antes de responder');
  });
});

/**
 * ── Só cartão, por enquanto ───────────────────────────────────────────────
 *
 * O Pix recorrente da Wiven existe na documentação e nunca foi exercitado
 * aqui. O modo de falha dele é o pior tipo: uma recorrência que não renova só
 * aparece trinta dias depois, quando o cliente já perdeu o acesso e ninguém
 * foi avisado de nada.
 */
describe('assinatura é só no cartão', () => {
  test('a tela esconde o Pix quando o plano é recorrente', () => {
    const tela = codigoDe('src/app/assinar/[id]/page.tsx');
    assert.match(tela, /somenteCartao=\{plano\.recorrente === 1\}/);
  });

  /**
   * Recusar é melhor que cair na cobrança avulsa: a queda daria 30 dias de
   * acesso SEM criar recorrência, a pessoa acharia que assinou, e a descoberta
   * viria um mês depois com o acesso fechando sozinho.
   */
  test('a rota recusa Pix em plano recorrente, em vez de virar cobrança única', () => {
    const rota = codigoDe('src/app/api/cobranca/[id]/pagamento/route.ts');
    assert.match(rota, /plano\.recorrente === 1 && meio === 'pix'/);
    assert.match(rota, /status: 400/);
  });

  test('o checkout abre direto no cartão nesse modo', () => {
    const checkout = codigoDe('src/components/checkout/Checkout.tsx');
    assert.match(checkout, /useState<MeioEscolhido>\(somenteCartao \? 'cartao' : 'pix'\)/);
  });

  /**
   * E a trava não pode ter comido o caminho antigo: plano de acesso único
   * (`recorrente = 0`) continua cobrável, nos dois meios, pela rota avulsa.
   */
  test('o caminho da cobrança única continua existindo', () => {
    const rota = codigoDe('src/app/api/cobranca/[id]/pagamento/route.ts');
    assert.match(rota, /resultado = await cobrar\(provedor\)/);
    // A recusa é condicionada; não existe recusa solta de Pix.
    assert.match(rota, /if \(plano\.recorrente === 1 && meio === 'pix'\)/);
  });
});
