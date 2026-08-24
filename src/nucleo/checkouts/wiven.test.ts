import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emCentavos,
  emReais,
  identificadorDe,
  pedidoDoIdentificador,
  traduzir,
  traduzirStatus,
} from './wiven';

describe('reais e centavos', () => {
  /**
   * A Wiven fala reais decimais; o projeto fala centavos inteiros. É a
   * fronteira onde o dinheiro pode mudar de valor sem ninguém ver.
   */
  test('os preços vigentes atravessam intactos', () => {
    assert.equal(emReais(980), 9.8); // Revelação
    assert.equal(emReais(1890), 18.9); // Completa
    assert.equal(emReais(490), 4.9); // upgrade
    assert.equal(emReais(2990), 29.9); // assinatura
  });

  /**
   * Sem o `toFixed(2)`, `1890 / 100` é 18.9 mas somas anteriores em float
   * chegam como `18.900000000000002` — e o gateway ou recusa, ou cobra um
   * centavo a mais. Mesma classe do bug que fez a Completa nascer em 2363.
   */
  test('nenhum valor sai com cauda de float', () => {
    for (let centavos = 1; centavos <= 5000; centavos++) {
      const reais = emReais(centavos);
      assert.equal(Math.round(reais * 100), centavos, `${centavos} centavos virou ${reais}`);
    }
  });

  test('a volta reconstrói o centavo', () => {
    assert.equal(emCentavos(9.8), 980);
    assert.equal(emCentavos(0.59), 59);
    assert.equal(emCentavos(null), null);
    assert.equal(emCentavos(undefined), null);
    assert.equal(emCentavos('nao é numero'), null);
  });
});

describe('o identificador da transação', () => {
  /**
   * A Wiven exige identificador único POR TRANSAÇÃO, e uma compra tem mais de
   * uma: cartão recusado e a pessoa tenta outro é o caso normal. Se o
   * identificador fosse o `pedidoId` puro, a segunda tentativa daria conflito
   * — e o sintoma seria perder a venda de quem estava mais decidido a comprar.
   */
  test('duas tentativas do mesmo pedido nunca colidem', () => {
    const a = identificadorDe('ped_123');
    const b = identificadorDe('ped_123');
    assert.notEqual(a, b);
  });

  test('o webhook reencontra o pedido pelo prefixo', () => {
    const id = identificadorDe('ped_123');
    assert.equal(pedidoDoIdentificador(id), 'ped_123');
  });

  /** Cobrança feita à mão no painel não tem sufixo — e ainda tem que achar. */
  test('identificador sem sufixo ainda devolve o pedido', () => {
    assert.equal(pedidoDoIdentificador('ped_123'), 'ped_123');
  });

  test('vazio não vira pedido', () => {
    assert.equal(pedidoDoIdentificador(''), null);
    assert.equal(pedidoDoIdentificador(null), null);
    assert.equal(pedidoDoIdentificador(undefined), null);
  });
});

describe('o vocabulário', () => {
  test('Wiven vira o que o resto do projeto já fala', () => {
    assert.equal(traduzirStatus('OK'), 'approved');
    assert.equal(traduzirStatus('PENDING'), 'pending');
    assert.equal(traduzirStatus('FAILED'), 'rejected');
    assert.equal(traduzirStatus('REJECTED'), 'rejected');
    assert.equal(traduzirStatus('CANCELED'), 'cancelled');
  });

  /** Status desconhecido não pode virar `approved` por acidente. */
  test('o que não se conhece não libera nada', () => {
    assert.equal(traduzirStatus('QUALQUER_COISA'), 'QUALQUER_COISA');
    assert.equal(traduzirStatus(undefined), 'unknown');
  });
});

describe('o Pix recém-criado não é venda', () => {
  /**
   * A resposta de criação do Pix traz `status: "OK"` — e ali o QR Code acabou
   * de nascer, ninguém pagou nada. Traduzir isso como `approved` gravaria uma
   * venda no instante em que a pessoa ainda está abrindo o aplicativo do
   * banco. É o bug de 22/08 (entrega sem cobrança virando receita no painel),
   * de novo, por outra porta.
   */
  test('OK na criação do Pix é pending', () => {
    const r = traduzir(
      { transactionId: 'tx_1', status: 'OK', pix: { code: '000201...', image: 'https://q/r' } },
      { identifier: 'ped_1--abc', meio: 'pix', brutoCentavos: 980 }
    );
    assert.equal(r.status, 'pending');
  });

  test('OK no cartão é approved — ali é síncrono de verdade', () => {
    const r = traduzir(
      { transactionId: 'tx_2', status: 'OK' },
      { identifier: 'ped_1--abc', meio: 'cartao', brutoCentavos: 980 }
    );
    assert.equal(r.status, 'approved');
  });

  test('o antifraude segurando o cartão vira pending', () => {
    const r = traduzir(
      { transactionId: 'tx_3', status: 'PENDING', details: 'ACQUIRER_ANTIFRAUD_REPROVED' },
      { identifier: 'ped_1--abc', meio: 'cartao', brutoCentavos: 980 }
    );
    assert.equal(r.status, 'pending');
    assert.equal(r.statusDetalhe, 'ACQUIRER_ANTIFRAUD_REPROVED');
  });
});

describe('o Pix desenhado sem base64', () => {
  /**
   * A Wiven deprecou o base64: o campo volta sempre vazio e quem desenha o QR
   * é a URL de `image`. Todo checkout do projeto lê `qrBase64` — inventar um
   * base64 aqui seria mentir para eles.
   */
  test('o copia-e-cola e a URL chegam; o base64 fica vazio', () => {
    const r = traduzir(
      {
        transactionId: 'tx_4',
        status: 'OK',
        pix: { code: '00020101...6304A8E3', image: 'https://q/r.png', base64: '' },
      },
      { identifier: 'ped_9--abc', meio: 'pix', brutoCentavos: 980 }
    );
    assert.equal(r.pix?.copiaECola, '00020101...6304A8E3');
    assert.equal(r.pix?.qrUrl, 'https://q/r.png');
    assert.equal(r.pix?.qrBase64, '');
  });
});

describe('o dinheiro que a Wiven devolve', () => {
  test('a taxa vira líquido sem ninguém digitar percentual', () => {
    const r = traduzir(
      { transactionId: 'tx_5', status: 'OK', amount: 9.8, fee: 2.58 },
      { identifier: 'ped_1--abc', meio: 'cartao', brutoCentavos: 980 }
    );
    assert.equal(r.brutoCentavos, 980);
    assert.equal(r.taxaCentavos, 258);
    assert.equal(r.liquidoCentavos, 722);
  });

  /** Sem `fee`, líquido é `null` — nunca o bruto, que viraria lucro fantasma. */
  test('taxa ausente não vira lucro', () => {
    const r = traduzir(
      { transactionId: 'tx_6', status: 'OK', amount: 9.8 },
      { identifier: 'ped_1--abc', meio: 'pix', brutoCentavos: 980 }
    );
    assert.equal(r.taxaCentavos, null);
    assert.equal(r.liquidoCentavos, null);
  });
});

/**
 * O CÓDIGO, sem comentários — os comentários deste módulo explicam justamente
 * por que o cartão não pode ser gravado, e citam os campos pelo nome.
 */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('o cartão só passa', () => {
  const fonte = codigoDe('src/nucleo/checkouts/wiven.ts');

  /**
   * A decisão de 23/08: passagem direta, sem persistência. O log de erro é
   * onde dado de cartão mais costuma vazar, porque ninguém trata log de erro
   * como dado sensível.
   */
  test('nada do cartão é gravado, guardado ou logado', () => {
    assert.doesNotMatch(fonte, /console\.(log|error|warn|info)\([^)]*c(artao|ard)/i);
    assert.doesNotMatch(fonte, /salvar|gravar|localStorage|writeFile/i);
  });

  test('o erro ecoa o gateway, nunca o corpo enviado', () => {
    assert.match(fonte, /await resposta\.text\(\)/);
    assert.doesNotMatch(fonte, /JSON\.stringify\(corpo\)[^)]*Error/);
  });

  /** Endereço é exigência do cartão. Pedir no Pix mataria o caminho curto. */
  test('o Pix não carrega endereço', () => {
    assert.match(fonte, /meio === 'cartao' \? \{ address: extra\.endereco \}/);
  });
});

describe('nasce desligado', () => {
  /**
   * Enquanto o webhook não existir, nada pode rotear para cá: sem webhook
   * nada libera acesso, e uma venda cobrada que nunca entrega é pior que uma
   * venda não feita.
   */
  test('o roteador ainda não conhece o nome wiven', () => {
    const fonte = codigoDe('src/nucleo/checkouts/gateway.ts');
    assert.doesNotMatch(fonte, /wiven/i);
  });
});
