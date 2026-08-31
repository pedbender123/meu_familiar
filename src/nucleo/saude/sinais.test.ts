import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { julgar, haQuanto, type Leitura, SEM_RASTREIO_PCT, TAXA_IMPLAUSIVEL_PCT } from './sinais';
import { quantosRuins, piorEstado, type GrupoDeSinais, type Sinal } from './tipos';

const AGORA = Date.parse('2026-08-30T20:00:00.000Z');

/** Um sistema em que tudo está certo. Cada teste estraga uma coisa só. */
function saudavel(): Leitura {
  return {
    agora: AGORA,
    gatewayPix: 'wiven',
    gatewayCartao: 'wiven',
    medicaoWiven: { ok: true, motivo: '', em: AGORA - 30_000 },
    quarentena: [],
    tentativas24h: 10,
    comCobranca24h: 10,
    pagos24h: 4,
    pagosSemCampanha24h: 0,
    pagosSemUtm24h: 0,
    entregasAtrasadas: 0,
    travadosGerando: 0,
    ultimoPagamentoEm: AGORA - 600_000,
    taxasImplausiveis: [],
    splitsQueNaoFecham: [],
    env: {
      utmifyToken: true,
      utmifyPixel: true,
      metaPixel: false,
      wivenChaves: true,
      wivenWebhookToken: true,
    },
    ipAtual: '72.61.133.109',
    ipAutorizado: '72.61.133.109',
  };
}

function todos(grupos: GrupoDeSinais[]): Sinal[] {
  return grupos.flatMap((g) => g.sinais);
}

function achar(grupos: GrupoDeSinais[], nome: string): Sinal {
  const s = todos(grupos).find((x) => x.nome === nome);
  assert.ok(s, `não existe sinal chamado "${nome}"`);
  return s;
}

describe('o sistema saudável', () => {
  test('não acende nada', () => {
    const grupos = julgar(saudavel());
    assert.equal(quantosRuins(grupos), 0);
    assert.equal(piorEstado(grupos), 'ok');
  });
});

/**
 * ── A régua do plano ──────────────────────────────────────────────────────
 *
 * `docs/PLANO-PAINEL-DE-SAUDE.md` §7: a tela está pronta quando, para cada um
 * dos cinco incidentes de agosto, existir uma linha que teria ficado vermelha
 * ANTES de o dono perceber sozinho. Um teste por incidente.
 */
describe('os cinco incidentes de agosto', () => {
  test('1. a Wiven passou 26 h devolvendo 403', () => {
    const l = saudavel();
    l.medicaoWiven = { ok: false, motivo: 'sonda: HTTP 403', em: AGORA - 3600_000 };

    const sinal = achar(julgar(l), 'Wiven responde');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.valor!, /403/);
    // Ela caiu por excesso de chamada: o conselho não pode ser "tente de novo".
    assert.match(sinal.oQueFazer!, /IP|chave/i);
  });

  test('2. a venda entrou na UTMify como venda direta, fora da campanha', () => {
    const l = saudavel();
    l.pagos24h = 4;
    l.pagosSemUtm24h = 4;

    const sinal = achar(julgar(l), 'Vendas com UTM');
    assert.equal(sinal.estado, 'atencao');
    assert.match(sinal.oQueFazer!, /UTM/i);
  });

  test('3. o split apareceu como taxa de gateway por três dias', () => {
    const l = saudavel();
    // A venda real: R$ 18,90 com "taxa" de R$ 12,57.
    l.taxasImplausiveis = [{ id: 'ped_1', pct: 66 }];

    const sinal = achar(julgar(l), 'Taxa plausível');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.oQueFazer!, /split/i);
  });

  test('4. o pixel ficou com a variável vazia', () => {
    const l = saudavel();
    l.env.utmifyPixel = false;

    const sinal = achar(julgar(l), 'Pixel da UTMify');
    assert.equal(sinal.estado, 'atencao');
    // NEXT_PUBLIC_ só existe depois de build — o conselho tem que dizer isso.
    assert.match(sinal.oQueFazer!, /build/i);
  });

  test('5. o pixel contou 17 vendas onde havia 5', () => {
    const l = saudavel();
    l.env.metaPixel = true;
    l.env.utmifyToken = true;

    const sinal = achar(julgar(l), 'Contagem em dobro');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.oQueFazer!, /META_PIXEL|UTMify/);
  });
});

describe('o silêncio do webhook', () => {
  /**
   * O sinal que teria pego a Wiven fora do ar antes de um cliente reclamar:
   * gente tentando pagar e nenhuma confirmação chegando.
   */
  test('tentaram pagar e nada confirmou: vermelho', () => {
    const l = saudavel();
    l.tentativas24h = 8;
    l.pagos24h = 0;

    const sinal = achar(julgar(l), 'Confirmação chegando');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.oQueFazer!, /webhook|token/i);
  });

  /**
   * E o contrário, que é o que separa alarme de barulho: sem tentativa
   * nenhuma, zero confirmação é o número CERTO. Pintar isso de vermelho
   * ensina a ignorar vermelho.
   */
  test('ninguém tentou pagar: desconhecido, não vermelho', () => {
    const l = saudavel();
    l.tentativas24h = 0;
    l.pagos24h = 0;

    assert.equal(achar(julgar(l), 'Confirmação chegando').estado, 'desconhecido');
  });

  test('madrugada silenciosa não acende nada', () => {
    const l = saudavel();
    l.tentativas24h = 0;
    l.comCobranca24h = 0;
    l.pagos24h = 0;

    assert.equal(quantosRuins(julgar(l)), 0);
  });
});

describe('o IP autorizado', () => {
  test('mudou de IP: vermelho antes de a cobrança quebrar', () => {
    const l = saudavel();
    l.ipAtual = '200.1.2.3';

    const sinal = achar(julgar(l), 'IP autorizado');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.valor!, /200\.1\.2\.3/);
  });

  test('sem IP cadastrado no .env é desconhecido, não vermelho', () => {
    const l = saudavel();
    l.ipAutorizado = null;

    assert.equal(achar(julgar(l), 'IP autorizado').estado, 'desconhecido');
  });

  test('rede caiu na hora de medir: desconhecido', () => {
    const l = saudavel();
    l.ipAtual = null;

    assert.equal(achar(julgar(l), 'IP autorizado').estado, 'desconhecido');
  });
});

describe('a Wiven desligada', () => {
  /**
   * Sem chave E sem nada roteando para lá não é falha: é uma máquina que não
   * usa a Wiven. Máquina de desenvolvimento é assim o tempo todo.
   */
  test('não configurada e não usada: desconhecido', () => {
    const l = saudavel();
    l.gatewayPix = 'mercadopago';
    l.gatewayCartao = 'mercadopago';
    l.env.wivenChaves = false;
    l.env.wivenWebhookToken = false;
    l.medicaoWiven = null;

    assert.equal(achar(julgar(l), 'Wiven responde').estado, 'desconhecido');
    assert.equal(achar(julgar(l), 'Credenciais da Wiven').estado, 'desconhecido');
    assert.equal(quantosRuins(julgar(l)), 0);
  });

  test('não configurada MAS o roteador manda para ela: vermelho', () => {
    const l = saudavel();
    l.env.wivenChaves = false;
    l.env.wivenWebhookToken = false;

    assert.equal(achar(julgar(l), 'Wiven responde').estado, 'quebrado');
    assert.equal(achar(julgar(l), 'Token do webhook').estado, 'quebrado');
  });
});

describe('os limiares', () => {
  test('taxa exatamente no limite não é acusada pela tela', () => {
    // Quem filtra por TAXA_IMPLAUSIVEL_PCT é a consulta; a tela só relata o
    // que veio. Este teste trava o contrato entre as duas.
    assert.equal(TAXA_IMPLAUSIVEL_PCT, 30);
    assert.equal(achar(julgar(saudavel()), 'Taxa plausível').estado, 'ok');
  });

  test('metade sem campanha ainda passa; mais que isso, não', () => {
    const l = saudavel();
    l.pagos24h = 10;
    l.pagosSemCampanha24h = SEM_RASTREIO_PCT / 10;
    assert.equal(achar(julgar(l), 'Vendas com campanha').estado, 'ok');

    l.pagosSemCampanha24h = 9;
    assert.equal(achar(julgar(l), 'Vendas com campanha').estado, 'atencao');
  });

  test('sem venda no período, rastreio é desconhecido', () => {
    const l = saudavel();
    l.pagos24h = 0;
    l.pagosSemCampanha24h = 0;
    l.pagosSemUtm24h = 0;

    assert.equal(achar(julgar(l), 'Vendas com campanha').estado, 'desconhecido');
    assert.equal(achar(julgar(l), 'Vendas com UTM').estado, 'desconhecido');
  });
});

describe('a entrega', () => {
  test('quem pagou e não recebeu acende vermelho', () => {
    const l = saudavel();
    l.entregasAtrasadas = 2;

    const sinal = achar(julgar(l), 'Pagou e recebeu');
    assert.equal(sinal.estado, 'quebrado');
    assert.match(sinal.oQueFazer!, /reprocessar/);
  });

  test('geração travada é atenção, não quebra', () => {
    const l = saudavel();
    l.travadosGerando = 1;

    assert.equal(achar(julgar(l), 'Geração de leitura').estado, 'atencao');
  });
});

/**
 * A regra que faz a tela servir ao dono em vez de me chamar às 3 da manhã.
 * Vale para TODO sinal ruim, em TODA combinação — por isso o teste varre um
 * sistema inteiramente quebrado em vez de conferir caso a caso.
 */
describe('todo sinal ruim diz o que fazer', () => {
  test('no sistema saudável', () => {
    for (const s of todos(julgar(saudavel()))) {
      if (s.estado === 'quebrado' || s.estado === 'atencao') {
        assert.ok(s.oQueFazer, `"${s.nome}" está ruim e não diz o que fazer`);
      }
    }
  });

  test('no sistema inteiramente quebrado', () => {
    const l: Leitura = {
      ...saudavel(),
      medicaoWiven: { ok: false, motivo: 'sonda: HTTP 500', em: AGORA - 1000 },
      quarentena: [{ nome: 'wiven', segundos: 120 }],
      tentativas24h: 5,
      comCobranca24h: 0,
      pagos24h: 3,
      pagosSemCampanha24h: 3,
      pagosSemUtm24h: 3,
      entregasAtrasadas: 4,
      travadosGerando: 2,
      taxasImplausiveis: [{ id: 'ped_x', pct: 66 }],
      splitsQueNaoFecham: ['ped_y'],
      env: {
        utmifyToken: true,
        utmifyPixel: false,
        metaPixel: true,
        wivenChaves: true,
        wivenWebhookToken: false,
      },
      ipAtual: '1.2.3.4',
      ipAutorizado: '5.6.7.8',
    };

    const grupos = julgar(l);
    assert.ok(quantosRuins(grupos) >= 10, 'um sistema todo quebrado tem que acender muita coisa');
    assert.equal(piorEstado(grupos), 'quebrado');

    for (const s of todos(grupos)) {
      if (s.estado === 'quebrado' || s.estado === 'atencao') {
        assert.ok(s.oQueFazer, `"${s.nome}" está ruim e não diz o que fazer`);
      }
    }
  });

  test('e nenhum sinal ruim é vago: a frase tem que caber uma ação', () => {
    const l = saudavel();
    l.env.utmifyToken = false;

    const sinal = achar(julgar(l), 'Token da UTMify');
    assert.equal(sinal.estado, 'quebrado');
    assert.ok(sinal.oQueFazer!.length > 30, 'conselho curto demais para ser acionável');
  });
});

describe('haQuanto', () => {
  test('fala como gente', () => {
    assert.equal(haQuanto(5_000), 'há 5 s');
    assert.equal(haQuanto(300_000), 'há 5 min');
    assert.equal(haQuanto(3 * 3600_000), 'há 3 h');
    assert.equal(haQuanto(3 * 24 * 3600_000), 'há 3 dias');
  });
});

/**
 * ── O diário do formato, e o nível em que ele procura ─────────────────────
 *
 * A documentação do webhook da Wiven põe `offerCode` e `checkoutUrl` no TOPO
 * do corpo, irmãos de `event` e `token` — não dentro de `transaction`, que é
 * onde ficam id, status e os valores.
 *
 * Procurar só na transação faria o diário registrar "não veio offerCode" para
 * sempre. E essa resposta errada é pior que resposta nenhuma: ela encerraria
 * a investigação da Fase 2 com uma conclusão falsa, e a decisão de migrar (ou
 * não) para produtos sairia dela.
 */
describe('o diário do formato do webhook', () => {
  const fonte = readFileSync('src/app/api/webhook/wiven/route.ts', 'utf8');

  test('procura nos dois níveis do corpo, não só na transação', () => {
    assert.match(fonte, /const topo = corpo as unknown as Record<string, unknown>/);
    assert.match(fonte, /const achar = \(k: string\) => t\[k\] \?\? topo\[k\]/);
  });

  test('offerCode e checkoutUrl estão na lista do que se procura', () => {
    const lista = fonte.slice(fonte.indexOf('const interessantes'), fonte.indexOf('const achar'));
    assert.match(lista, /'offerCode'/);
    assert.match(lista, /'checkoutUrl'/);
  });

  /** Arquivo de diagnóstico vira backup, e backup sai da máquina. */
  test('não grava dado de cliente', () => {
    const bloco = fonte.slice(fonte.indexOf('function anotarFormato'), fonte.indexOf('export async function POST'));
    for (const proibido of ['client', 'email', 'cpf', 'name', 'phone']) {
      assert.doesNotMatch(
        bloco,
        new RegExp(`\\b${proibido}\\b\\s*:`),
        `o diário não pode gravar ${proibido}`
      );
    }
  });
});
