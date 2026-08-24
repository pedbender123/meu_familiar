import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ehGateway, NOMES_DE_GATEWAY, ROTULO_DO_GATEWAY } from './nomes';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('a campanha do painel escolhe o checkout', () => {
  /**
   * A primeira tentativa casava o `utm_campaign` por texto, e era frágil de
   * dois jeitos: o link da Meta carrega o ID NUMÉRICO da campanha
   * (`120248890724340044`), não o nome — então uma regra escrita pelo nome
   * falharia calada, mandando a venda para a conta errada — e mudar a regra
   * exigia entrar na VPS.
   *
   * A campanha do painel já é gravada no pedido como `campanha_id` desde que
   * ele nasce. Escolher o checkout virou igual a escolher a página de vendas.
   */
  test('a decisão sai do campanha_id, não do utm', () => {
    const fonte = codigoDe('src/nucleo/checkouts/gateway.ts');
    assert.match(fonte, /export function gatewayDaCampanha\(\s*campanhaId/);
    assert.match(fonte, /buscarCampanha\(campanhaId\)/);
    assert.doesNotMatch(fonte, /GATEWAY_POR_CAMPANHA/);
  });

  /**
   * O corpo da requisição de pagamento vem do navegador. Deixar o cliente
   * dizer de qual campanha ele veio é deixar o cliente escolher em qual conta
   * o dinheiro cai.
   */
  test('a cobrança lê a campanha do pedido, nunca do corpo', () => {
    const fonte = codigoDe('src/app/api/pedido/[id]/pagamento/route.ts');
    assert.match(fonte, /gatewayDe\(meio, pedido\.campanha_id\)/);
    assert.match(fonte, /provedorPara\(meio, pedido\.campanha_id\)/);
  });

  /** A tela e a cobrança precisam concordar, senão cobra por outro gateway. */
  test('a tela de checkout resolve pelo mesmo campo', () => {
    const fonte = codigoDe('src/app/pagamento/[id]/page.tsx');
    assert.match(fonte, /pedido\.campanha_id/);
  });

  /**
   * Nome inventado no formulário viraria campanha que não consegue cobrar, e
   * o sintoma apareceria só na primeira pessoa que tentasse pagar.
   */
  test('só gateway conhecido é aceito no formulário', () => {
    assert.equal(ehGateway('wiven'), true);
    assert.equal(ehGateway('mercadopago'), true);
    assert.equal(ehGateway('cakto'), true);
    assert.equal(ehGateway('pagseguro'), false);
    assert.equal(ehGateway(''), false);
    assert.equal(ehGateway(null), false);
    assert.equal(ehGateway(undefined), false);
  });

  /** `null` explícito devolve a campanha ao padrão; ausente não mexe. */
  test('dá para desfazer a escolha', () => {
    const fonte = codigoDe('src/app/api/painel/campanha/route.ts');
    assert.match(fonte, /'gateway' in c/);
    assert.match(fonte, /ehGateway\(c\.gateway\) \? c\.gateway : null/);
  });

  test('todo gateway tem rótulo para o painel', () => {
    for (const n of NOMES_DE_GATEWAY) {
      assert.equal(typeof ROTULO_DO_GATEWAY[n], 'string');
      assert.ok(ROTULO_DO_GATEWAY[n].length > 0, n);
    }
  });
});

describe('o painel não arrasta o banco para o navegador', () => {
  /**
   * O seletor é componente de cliente e precisa só da LISTA de nomes.
   * `gateway.ts` lê a campanha no banco para decidir quem cobra, e importar
   * de lá levava `better-sqlite3` para dentro do bundle — o build quebrava em
   * `Can't resolve 'fs'`.
   *
   * Separar o vocabulário da decisão é a divisão certa de qualquer forma: a
   * lista de gateways é um fato do domínio, não uma regra de negócio.
   */
  test('o módulo de nomes não importa nada', () => {
    const fonte = codigoDe('src/nucleo/checkouts/nomes.ts');
    assert.doesNotMatch(fonte, /^import /m);
  });

  test('o seletor do painel importa dos nomes, não do gateway', () => {
    const fonte = codigoDe('src/components/painel/EscolhaDeCheckout.tsx');
    assert.match(fonte, /from '@\/nucleo\/checkouts\/nomes'/);
    assert.doesNotMatch(fonte, /from '@\/nucleo\/checkouts\/gateway'/);
  });
});
