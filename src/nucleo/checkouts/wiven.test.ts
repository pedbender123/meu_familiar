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
  traduzirWebhook,
  pedidoDoWebhook,
  urlDeCallback,
  CAMINHO_DO_WEBHOOK,
  tokensDoWebhook,
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
  const fonte = codigoDe('src/nucleo/checkouts/gateway.ts');

  /**
   * O padrão é Mercado Pago. Esquecer de configurar não pode mandar dinheiro
   * para um gateway que ninguém testou.
   */
  test('a Wiven só cobra quando alguém pede por nome', () => {
    assert.match(fonte, /normalizar\(process\.env\.GATEWAY\) \?\? 'mercadopago'/);
  });

  /**
   * ── A checagem que evita o pior desfecho possível ───────────────────────
   *
   * As chaves da API bastam para CRIAR a cobrança. Mas quem libera acesso é
   * o webhook, e `/api/webhook/wiven` recusa tudo sem `WIVEN_WEBHOOK_TOKEN`.
   *
   * Uma Wiven configurada pela metade — chaves sim, token não — cobraria
   * normalmente e nunca entregaria. Dinheiro na conta, cliente sem produto, e
   * o único vestígio num log de webhook que ninguém abre. Configuração pela
   * metade tem que falhar na porta de entrada.
   */
  test('sem token de webhook, a Wiven não cobra', () => {
    assert.match(fonte, /escolhido === 'wiven' && !tokenDoWebhook\(\)/);
  });

  test('sem chaves de API, a Wiven não cobra', () => {
    assert.match(fonte, /escolhido === 'wiven' && !wivenConfigurada\(\)/);
  });

  /** Os dois desvios caem no Mercado Pago, nunca num erro na cara de quem compra. */
  test('todo desvio volta para o Mercado Pago', () => {
    const trechos = fonte.split("escolhido === 'wiven'").slice(1);
    assert.equal(trechos.length, 2);
    for (const t of trechos) assert.match(t, /return 'mercadopago';/);
  });
});

describe('o cartão da Wiven não deixa rastro no navegador', () => {
  const fonte = codigoDe('src/components/checkout/Wiven.tsx');

  /**
   * Não há tokenização: os campos vivem em estado de React e morrem com a
   * aba. Persistir qualquer um deles colocaria PAN no disco de quem comprou.
   */
  test('nada é gravado em storage nem em cookie', () => {
    assert.doesNotMatch(fonte, /localStorage|sessionStorage|document\.cookie/);
  });

  /**
   * Etapa escondida por CSS ainda é campo tabulável, e o leitor de tela
   * anunciaria treze campos onde a tela mostra quatro.
   */
  test('a etapa não visível fica fora do DOM', () => {
    assert.match(fonte, /if \(!visivel\) return null;/);
  });

  /** Serviço de CEP fora do ar não pode virar venda perdida. */
  test('o CEP que falha libera os campos à mão', () => {
    assert.match(fonte, /cepFalhou/);
  });
});

describe('a Wiven fala dois idiomas', () => {
  /**
   * A criação devolve `OK`; o webhook devolve `COMPLETED`. Só `PENDING` e
   * `FAILED` são comuns aos dois.
   *
   * Uma tradução que só conhecesse o vocabulário da criação jamais
   * reconheceria `COMPLETED` — que é justamente o que chega quando o dinheiro
   * entra. Todo mundo pagaria, ninguém receberia, e o log diria só
   * `pagamento_COMPLETED` antes de seguir em frente.
   */
  test('COMPLETED, do webhook, é venda', () => {
    assert.equal(traduzirStatus('COMPLETED'), 'approved');
  });

  test('o resto do vocabulário do webhook', () => {
    assert.equal(traduzirStatus('REFUNDED'), 'refunded');
    assert.equal(traduzirStatus('CHARGED_BACK'), 'charged_back');
    assert.equal(traduzirStatus('PENDING'), 'pending');
    assert.equal(traduzirStatus('FAILED'), 'rejected');
  });
});

describe('o corpo do webhook', () => {
  const pago = {
    event: 'TRANSACTION_PAID',
    token: 'segredo',
    transaction: {
      id: 'tx_9',
      identifier: 'ped_42--f1e2',
      status: 'COMPLETED',
      paymentMethod: 'PIX',
      amount: 9.8,
      commissionAmount: 7.22,
      payedAt: '2026-08-23T14:53:48.894Z',
    },
  };

  test('vira o mesmo ResultadoPagamento de sempre', () => {
    const r = traduzirWebhook(pago);
    assert.equal(r.idExterno, 'tx_9');
    assert.equal(r.status, 'approved');
    assert.equal(r.referenciaExterna, 'ped_42');
    assert.equal(r.metodo, 'pix');
  });

  /**
   * Na criação, `fee` é A TAXA. No webhook, `commissionAmount` é O LÍQUIDO.
   * Mesmo gateway, dois campos de dinheiro com sentidos opostos — tratar um
   * como o outro inverteria o painel financeiro.
   */
  test('commissionAmount é o líquido, não a taxa', () => {
    const r = traduzirWebhook(pago);
    assert.equal(r.brutoCentavos, 980);
    assert.equal(r.liquidoCentavos, 722);
    assert.equal(r.taxaCentavos, 258);
  });

  /**
   * A documentação marca `identifier` como anulável, e o exemplo de payload
   * dela nem sequer o traz. Sem o segundo caminho — `transaction.id`, que a
   * gente grava no pedido na criação — a venda ficaria órfã.
   */
  test('identifier nulo não derruba a notificação', () => {
    const r = traduzirWebhook({ ...pago, transaction: { ...pago.transaction, identifier: null } });
    assert.equal(r.referenciaExterna, null);
    assert.equal(r.idExterno, 'tx_9', 'o transaction.id ainda acha o pedido');
    assert.equal(r.status, 'approved');
  });

  test('o pedido sai do prefixo do identificador', () => {
    assert.equal(pedidoDoWebhook(pago), 'ped_42');
    assert.equal(pedidoDoWebhook({}), null);
  });

  test('corpo sem dinheiro não inventa lucro', () => {
    const r = traduzirWebhook({ event: 'TRANSACTION_CREATED', transaction: { id: 'tx_0', status: 'PENDING' } });
    assert.equal(r.brutoCentavos, null);
    assert.equal(r.liquidoCentavos, null);
    assert.equal(r.taxaCentavos, null);
    assert.equal(r.status, 'pending');
  });
});

describe('o webhook tem duas portas', () => {
  const fonte = codigoDe('src/app/api/webhook/wiven/route.ts');

  /**
   * O token viaja em texto no corpo a cada notificação. `===` vazaria, pelo
   * tempo que leva para falhar, quantos caracteres iniciais estavam certos.
   */
  test('o token é comparado em tempo constante', () => {
    assert.match(fonte, /timingSafeEqual/);
  });

  test('sem token configurado, recusa tudo', () => {
    assert.match(fonte, /if \(esperados\.length === 0\)/);
  });

  /**
   * Se o token vazar, um POST forjado libera acesso — e reconsultar a API,
   * que seria a defesa natural, esbarra no "Polling bloqueado" deles. Então
   * o preço é recalculado do nosso lado.
   */
  test('o valor é conferido contra o nosso banco', () => {
    assert.match(fonte, /precoDoPedido\(pedido\)\.finalCentavos/);
    assert.match(fonte, /resultado\.brutoCentavos < esperadoCentavos/);
  });

  /** A entrega não pode segurar a resposta: timeout vira evento reenviado. */
  test('só a parte síncrona é aguardada', () => {
    assert.match(fonte, /await processarNotificacaoDePagamento\(resultado\)/);
  });
});

describe('para onde a Wiven avisa', () => {
  const guardado = { ...process.env };
  const restaurar = () => {
    process.env.BASE_URL = guardado.BASE_URL;
    process.env.WIVEN_CALLBACK_URL = guardado.WIVEN_CALLBACK_URL;
  };

  test('o caminho é o da rota que existe no disco', () => {
    assert.equal(CAMINHO_DO_WEBHOOK, '/api/webhook/wiven');
  });

  /**
   * O erro que já aconteceu neste projeto: a Cakto ficou com `salesPage` em
   * `http://localhost:3000` porque ninguém checou.
   *
   * Aqui seria pior que uma vitrine feia — um `callbackUrl` de localhost é
   * uma cobrança que NUNCA confirma: a Wiven bate num endereço que só existe
   * nesta máquina, desiste, e o pedido fica em `aguardando_pagamento` para
   * sempre com o dinheiro já pago.
   */
  test('localhost nunca vira callback', () => {
    for (const local of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://0.0.0.0:8080',
      'http://localhost',
    ]) {
      delete process.env.WIVEN_CALLBACK_URL;
      process.env.BASE_URL = local;
      assert.equal(urlDeCallback(), 'https://bruxario.com.br/api/webhook/wiven', local);
    }
    restaurar();
  });

  test('um túnel explícito ganha de tudo', () => {
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.WIVEN_CALLBACK_URL = 'https://algo.ngrok.app';
    assert.equal(urlDeCallback(), 'https://algo.ngrok.app/api/webhook/wiven');
    restaurar();
  });

  test('em produção, sai o domínio de produção', () => {
    delete process.env.WIVEN_CALLBACK_URL;
    process.env.BASE_URL = 'https://bruxario.com.br';
    assert.equal(urlDeCallback(), 'https://bruxario.com.br/api/webhook/wiven');
    restaurar();
  });

  /** Barra sobrando no fim não pode virar `//api/webhook/wiven`. */
  test('a barra do fim não duplica', () => {
    delete process.env.WIVEN_CALLBACK_URL;
    process.env.BASE_URL = 'https://bruxario.com.br/';
    assert.equal(urlDeCallback(), 'https://bruxario.com.br/api/webhook/wiven');
    restaurar();
  });
});

describe('o cache de borda da Wiven', () => {
  const fonte = codigoDe('src/nucleo/checkouts/wiven.ts');

  /**
   * Medido em produção, 24/08, com um Pix de R$ 5 pago de verdade:
   * `GET /gateway/transactions` responde por CloudFront com
   * `x-cache: Hit from cloudfront` e `age: 511`. Numa rota que responde
   * "esta pessoa pagou?".
   *
   * E a chave do cache inclui o `Accept-Encoding`: `curl` (sem compressão)
   * via `COMPLETED` enquanto o `fetch` do Node (que pede gzip) via `PENDING`
   * — mesma URL, mesma máquina, mesmo segundo.
   */
  test('toda leitura leva um parâmetro que nunca se repete', () => {
    assert.match(fonte, /function furarCache/);
    assert.match(fonte, /ehLeitura \? furarCache\(caminho\) : caminho/);
  });

  /** `Cache-Control: no-cache` foi testado contra a API real e é ignorado. */
  test('não se confia em cabeçalho de cache', () => {
    assert.doesNotMatch(fonte, /'Cache-Control'/);
  });

  /**
   * Só em GET. Sujar o corpo de uma cobrança com parâmetro de conveniência é
   * convite para o gateway recusar a transação.
   */
  test('a cobrança não é suja com parâmetro de cache', () => {
    assert.match(fonte, /!init\.method \|\| init\.method\.toUpperCase\(\) === 'GET'/);
  });

  test('o parâmetro muda a cada chamada', () => {
    assert.match(fonte, /Date\.now\(\)/);
    assert.match(fonte, /Math\.random\(\)/);
  });

  /** URL que já tem query não pode ganhar um segundo `?`. */
  test('o separador respeita a query que já existe', () => {
    assert.match(fonte, /caminho\.includes\('\?'\) \? '&' : '\?'/);
  });
});

describe('a Wiven entrega o mesmo evento duas vezes', () => {
  const guardado = process.env.WIVEN_WEBHOOK_TOKEN;
  const restaurar = () => {
    process.env.WIVEN_WEBHOOK_TOKEN = guardado;
  };

  /**
   * Medido em 24/08. Ela entrega por dois caminhos com credenciais
   * diferentes: o webhook que a conta já tinha, e um que **ela cria sozinha**
   * a partir do `callbackUrl` que mandamos no corpo de cada cobrança — esse
   * nasce com token próprio, e aparece no painel como "API CallbackURL".
   *
   * Apareceu como oito `token não confere` no log. Nada se perdia, mas log
   * cheio de recusa de autenticação é alarme que se aprende a ignorar.
   */
  test('dois tokens, separados por vírgula', () => {
    process.env.WIVEN_WEBHOOK_TOKEN = 'py4abcdnr,o1p6sn84';
    assert.deepEqual(tokensDoWebhook(), ['py4abcdnr', 'o1p6sn84']);
    restaurar();
  });

  /** Token colado de painel vem com espaço mais vezes do que se imagina. */
  test('espaço em volta não invalida token', () => {
    process.env.WIVEN_WEBHOOK_TOKEN = ' py4abcdnr , o1p6sn84 ';
    assert.deepEqual(tokensDoWebhook(), ['py4abcdnr', 'o1p6sn84']);
    restaurar();
  });

  /** Vírgula sobrando não pode virar um token vazio que aceita tudo. */
  test('token vazio nunca entra na lista', () => {
    process.env.WIVEN_WEBHOOK_TOKEN = 'py4abcdnr,,';
    assert.deepEqual(tokensDoWebhook(), ['py4abcdnr']);
    process.env.WIVEN_WEBHOOK_TOKEN = '';
    assert.deepEqual(tokensDoWebhook(), []);
    process.env.WIVEN_WEBHOOK_TOKEN = ' , ';
    assert.deepEqual(tokensDoWebhook(), []);
    restaurar();
  });

  test('a rota aceita qualquer um dos cadastrados', () => {
    const fonte = codigoDe('src/app/api/webhook/wiven/route.ts');
    assert.match(fonte, /esperados\.some\(\(e\) => tokenConfere\(corpo\?\.token, e\)\)/);
    assert.match(fonte, /esperados\.length === 0/);
  });
});
