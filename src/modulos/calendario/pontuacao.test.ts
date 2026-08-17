import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { pontuarDia, destaqueDo, classificar, DOMINIOS } from './pontuacao';
import { mapaNatal, separacao, aspectoEntre } from './transitos';
import { calcularCalendario, calendarioDaConta, diasDoAlcance, diasDeOuro } from './calendario';

/** Um mapa fixo, pra tudo aqui ser reproduzível. */
const NATAL = mapaNatal({
  data: '1994-11-08',
  hora: '03:20',
  lat: -23.5505,
  lon: -46.6333,
  horaAproximada: false,
});

describe('separacao', () => {
  test('nunca passa de 180', () => {
    assert.equal(separacao(0, 350), 10);
    assert.equal(separacao(350, 0), 10);
    assert.equal(separacao(0, 180), 180);
    assert.equal(separacao(10, 200), 170);
  });
});

describe('aspectoEntre', () => {
  test('conjunção exata tem força 1', () => {
    const a = aspectoEntre(100, 100)!;
    assert.equal(a.aspecto.nome, 'conjunção');
    assert.equal(a.forca, 1);
  });

  test('aspecto na borda do orbe tem força perto de zero', () => {
    const a = aspectoEntre(0, 120 + 5.9)!;
    assert.equal(a.aspecto.nome, 'trígono');
    assert.ok(a.forca < 0.05, `esperava força quase nula, veio ${a.forca}`);
  });

  test('fora de qualquer orbe devolve null', () => {
    assert.equal(aspectoEntre(0, 45), null);
  });

  test('quadratura e oposição são desarmônicas; trígono e sextil, harmônicos', () => {
    assert.equal(aspectoEntre(0, 90)!.aspecto.harmonia, -1);
    assert.equal(aspectoEntre(0, 180)!.aspecto.harmonia, -1);
    assert.equal(aspectoEntre(0, 120)!.aspecto.harmonia, 1);
    assert.equal(aspectoEntre(0, 60)!.aspecto.harmonia, 1);
  });
});

describe('pontuarDia', () => {
  test('é determinístico — a mesma data devolve exatamente a mesma nota', () => {
    const quando = new Date('2026-03-15T12:00:00Z');
    assert.deepEqual(pontuarDia(NATAL, quando), pontuarDia(NATAL, quando));
  });

  test('toda nota fica entre 0 e 100', () => {
    for (let dia = 0; dia < 120; dia++) {
      const p = pontuarDia(NATAL, new Date(2026, 0, 1 + dia, 12));
      for (const dominio of DOMINIOS) {
        assert.ok(
          p[dominio] >= 0 && p[dominio] <= 100,
          `${dominio} saiu da faixa: ${p[dominio]}`
        );
      }
    }
  });

  test('as notas variam ao longo do ano — não é sempre 50', () => {
    const notas = new Set(
      Array.from({ length: 90 }, (_, d) => pontuarDia(NATAL, new Date(2026, 0, 1 + d, 12)).amor)
    );
    assert.ok(notas.size > 10, `esperava variação real, vieram ${notas.size} valores`);
  });

  test('mapa sem ascendente ainda pontua (quem não sabe a hora não fica sem calendário)', () => {
    const semAscendente = { ...NATAL, ascendente: null };
    const p = pontuarDia(semAscendente, new Date('2026-03-15T12:00:00Z'));
    for (const dominio of DOMINIOS) {
      assert.ok(Number.isFinite(p[dominio]));
    }
  });
});

describe('classificar', () => {
  test('os cortes seguem a escala declarada', () => {
    assert.equal(classificar(85), 'ouro');
    assert.equal(classificar(70), 'ouro');
    assert.equal(classificar(60), 'bom');
    assert.equal(classificar(50), 'neutro');
    assert.equal(classificar(20), 'recolher');
  });
});

describe('destaqueDo', () => {
  test('devolve o domínio de maior nota', () => {
    const d = destaqueDo({ amor: 40, carreira: 90, viagens: 50, fortuna: 20 });
    assert.equal(d.dominio, 'carreira');
    assert.equal(d.nota, 90);
  });
});

describe('alcance do plano decide o tamanho — e o custo', () => {
  test('nenhum devolve null: plano sem calendário não gasta CPU nenhuma', () => {
    assert.equal(diasDoAlcance('nenhum'), 0);
    assert.equal(calcularCalendario(NATAL, 'nenhum'), null);
  });

  test('semana dá 7 dias', () => {
    assert.equal(calcularCalendario(NATAL, 'semana', new Date(2026, 2, 10))!.length, 7);
  });

  test('mes cobre o mês inteiro a partir do dia 1', () => {
    const c = calcularCalendario(NATAL, 'mes', new Date(2026, 2, 10))!;
    assert.equal(c.length, 31, 'março tem 31 dias');
    assert.equal(c[0].diaDoMes, 1, 'mês começa no dia 1, não em hoje');
  });

  test('mes respeita meses curtos', () => {
    assert.equal(calcularCalendario(NATAL, 'mes', new Date(2026, 1, 10))!.length, 28);
  });

  test('ano dá 365 dias começando em hoje', () => {
    const c = calcularCalendario(NATAL, 'ano', new Date(2026, 2, 10))!;
    assert.equal(c.length, 365);
    assert.equal(c[0].data, '2026-03-10');
  });

  test('um ano inteiro calcula rápido — é CPU local, não rede', () => {
    const inicio = Date.now();
    calcularCalendario(NATAL, 'ano', new Date(2026, 0, 1));
    const levou = Date.now() - inicio;
    assert.ok(levou < 3000, `365 dias levaram ${levou}ms`);
  });

  test('as datas não repetem nem pulam', () => {
    const c = calcularCalendario(NATAL, 'ano', new Date(2026, 2, 10))!;
    assert.equal(new Set(c.map((d) => d.data)).size, 365);
  });
});

describe('calendarioDaConta', () => {
  const dados = {
    data: '1994-11-08',
    hora: '03:20',
    lat: -23.5505,
    lon: -46.6333,
    horaAproximada: false,
  };

  test('sem direito, null — mesmo com todos os dados', () => {
    assert.equal(calendarioDaConta(dados, 'nenhum'), null);
  });

  test('sem data de nascimento, null — mesmo com direito', () => {
    assert.equal(calendarioDaConta({ ...dados, data: null }, 'ano'), null);
  });

  test('sem coordenada, null', () => {
    assert.equal(calendarioDaConta({ ...dados, lat: null }, 'ano'), null);
  });

  test('com direito e dados, devolve o calendário', () => {
    const c = calendarioDaConta(dados, 'semana', new Date(2026, 2, 10));
    assert.equal(c?.length, 7);
  });

  test('hora aproximada não impede — só perde o ascendente', () => {
    const c = calendarioDaConta({ ...dados, horaAproximada: true }, 'semana');
    assert.equal(c?.length, 7);
  });
});

test('diasDeOuro devolve só os classificados como ouro, do melhor pro pior', () => {
  const c = calcularCalendario(NATAL, 'ano', new Date(2026, 0, 1))!;
  const ouro = diasDeOuro(c, 5);

  assert.ok(ouro.length <= 5);
  assert.ok(ouro.every((d) => d.classe === 'ouro'));
  for (let i = 1; i < ouro.length; i++) {
    assert.ok(ouro[i - 1].destaque.nota >= ouro[i].destaque.nota);
  }
});
