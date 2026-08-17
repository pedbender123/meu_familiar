import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pontuarDia,
  destaqueDo,
  classificar,
  ehDiaDeOuro,
  agregar,
  DOMINIOS,
} from './pontuacao';
import { mapaNatal, separacao, aspectoEntre } from './transitos';
import { calcularMes, mapaDaConta, mesesNavegaveis, diasDeOuro } from './calendario';
import { fraseDoDia, fraseDoDominio } from './frases';

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

describe('alcance do plano decide o que é calculado — e o custo', () => {
  const hoje = new Date(2026, 2, 10);

  test('nenhum: o mês vem inteiro de cadeados, nada é calculado', () => {
    const mes = calcularMes(NATAL, 'nenhum', 2026, 2, hoje);
    assert.equal(mes.dias.length, 31, 'a grade existe mesmo sem direito');
    assert.ok(mes.dias.every((d) => !d.liberado));
    assert.equal(mes.resumo, null);
    assert.equal(mes.temDiaLiberado, false);
  });

  test('semana: 7 dias liberados a partir de hoje, o resto do mês trancado', () => {
    const mes = calcularMes(NATAL, 'semana', 2026, 2, hoje);
    const liberados = mes.dias.filter((d) => d.liberado);
    assert.equal(liberados.length, 7);
    assert.equal(liberados[0].diaDoMes, 10, 'começa hoje');
    assert.equal(liberados[6].diaDoMes, 16);
    assert.ok(mes.dias.filter((d) => !d.liberado).length > 20, 'o resto fica com cadeado');
  });

  test('semana não enxerga o passado do mês', () => {
    const mes = calcularMes(NATAL, 'semana', 2026, 2, hoje);
    assert.ok(mes.dias.slice(0, 9).every((d) => !d.liberado));
  });

  test('mes: o mês corrente inteiro, inclusive os dias já passados', () => {
    const mes = calcularMes(NATAL, 'mes', 2026, 2, hoje);
    assert.ok(mes.dias.every((d) => d.liberado), 'mês corrente todo aberto');
    assert.equal(mes.dias[0].diaDoMes, 1);
  });

  test('ano: um mês distante ainda vem liberado', () => {
    const mes = calcularMes(NATAL, 'ano', 2026, 8, hoje);
    assert.ok(mes.dias.every((d) => d.liberado));
    assert.ok(mes.resumo);
  });

  test('grátis navegando pro mês que vem: tudo trancado, custo zero', () => {
    const mes = calcularMes(NATAL, 'semana', 2026, 5, hoje);
    assert.ok(mes.dias.every((d) => !d.liberado));
    assert.equal(mes.semanas.length, 0, 'sem dia calculado não há semana pra resumir');
  });

  test('um ano de meses calcula rápido — é CPU local, não rede', () => {
    const inicio = Date.now();
    for (const { ano, mes } of mesesNavegaveis(hoje)) {
      calcularMes(NATAL, 'ano', ano, mes, hoje);
    }
    const levou = Date.now() - inicio;
    assert.ok(levou < 4000, `12 meses levaram ${levou}ms`);
  });

  test('as datas do mês não repetem nem pulam', () => {
    const mes = calcularMes(NATAL, 'mes', 2026, 1, hoje);
    assert.equal(mes.dias.length, 28, 'fevereiro de 2026');
    assert.equal(new Set(mes.dias.map((d) => d.data)).size, 28);
  });

  test('diaDaSemana bate com o calendário real', () => {
    const mes = calcularMes(NATAL, 'mes', 2026, 2, hoje);
    assert.equal(mes.dias[0].diaDaSemana, new Date(2026, 2, 1).getDay());
  });
});

describe('dia de ouro é sorte em TUDO', () => {
  test('não marca ouro um dia ótimo em um domínio e ruim no resto', () => {
    assert.equal(ehDiaDeOuro({ amor: 95, carreira: 30, viagens: 30, fortuna: 30 }), false);
  });

  test('marca ouro quando as quatro portas estão abertas', () => {
    assert.equal(ehDiaDeOuro({ amor: 70, carreira: 68, viagens: 66, fortuna: 72 }), true);
  });

  test('um domínio baixo já tira o ouro, por melhor que seja o resto', () => {
    assert.equal(ehDiaDeOuro({ amor: 90, carreira: 90, viagens: 90, fortuna: 50 }), false);
  });

  test('dia de ouro é raro no ano inteiro (senão a cor não destaca nada)', () => {
    let ouro = 0;
    let total = 0;
    for (const { ano, mes } of mesesNavegaveis(new Date(2026, 0, 1))) {
      for (const dia of calcularMes(NATAL, 'ano', ano, mes, new Date(2026, 0, 1)).dias) {
        total++;
        if (dia.ouro) ouro++;
      }
    }
    const proporcao = ouro / total;
    assert.ok(proporcao < 0.25, `${Math.round(proporcao * 100)}% de dias de ouro é demais`);
  });
});

describe('resumos de período', () => {
  const hoje = new Date(2026, 2, 10);

  test('o mês tem nota geral e frase', () => {
    const mes = calcularMes(NATAL, 'mes', 2026, 2, hoje);
    assert.ok(mes.resumo!.geral >= 0 && mes.resumo!.geral <= 100);
    assert.ok(mes.resumo!.frase.length > 10);
  });

  test('cada semana com dia liberado ganha resumo', () => {
    const mes = calcularMes(NATAL, 'mes', 2026, 2, hoje);
    assert.ok(mes.semanas.length >= 4);
    for (const semana of mes.semanas) {
      assert.ok(semana.resumo.frase.length > 10);
      assert.ok(semana.resumo.geral >= 0 && semana.resumo.geral <= 100);
    }
  });

  test('agregar tira a média por domínio', () => {
    const r = agregar([
      { amor: 60, carreira: 40, viagens: 50, fortuna: 80 },
      { amor: 80, carreira: 60, viagens: 50, fortuna: 60 },
    ]);
    assert.equal(r.porDominio.amor, 70);
    assert.equal(r.porDominio.carreira, 50);
    assert.equal(r.geral, 60);
  });
});

describe('frases', () => {
  test('a mesma data devolve sempre a mesma frase', () => {
    const a = fraseDoDia('2026-03-15', 'amor', 'bom', false, false);
    const b = fraseDoDia('2026-03-15', 'amor', 'bom', false, false);
    assert.equal(a, b);
  });

  test('datas diferentes variam as frases', () => {
    const frases = new Set(
      Array.from({ length: 20 }, (_, i) =>
        fraseDoDia(`2026-03-${String(i + 1).padStart(2, '0')}`, 'amor', 'bom', false, false)
      )
    );
    assert.ok(frases.size > 1);
  });

  test('dia de ouro tem frase própria, não a do domínio', () => {
    const ouro = fraseDoDia('2026-03-15', 'amor', 'ouro', true, false);
    const comum = fraseDoDia('2026-03-15', 'amor', 'ouro', false, false);
    assert.notEqual(ouro, comum);
  });

  test('toda combinação de domínio e classe tem frase', () => {
    for (const dominio of DOMINIOS) {
      for (const classe of ['ouro', 'bom', 'neutro', 'recolher'] as const) {
        assert.ok(fraseDoDominio('2026-03-15', dominio, classe).length > 10);
      }
    }
  });
});

describe('mapaDaConta', () => {
  const dados = {
    data: '1994-11-08',
    hora: '03:20',
    lat: -23.5505,
    lon: -46.6333,
    horaAproximada: false,
  };

  test('sem data de nascimento, null', () => {
    assert.equal(mapaDaConta({ ...dados, data: null }), null);
  });

  test('sem coordenada, null', () => {
    assert.equal(mapaDaConta({ ...dados, lat: null }), null);
  });

  test('com tudo, devolve o mapa', () => {
    const m = mapaDaConta(dados);
    assert.ok(m);
    assert.ok(Number.isFinite(m!.sol));
    assert.ok(m!.ascendente !== null);
  });

  test('hora aproximada zera o ascendente em vez de chutá-lo', () => {
    assert.equal(mapaDaConta({ ...dados, horaAproximada: true })!.ascendente, null);
  });
});

test('diasDeOuro devolve só os dias bons em tudo, do melhor pro pior', () => {
  const mes = calcularMes(NATAL, 'ano', 2026, 5, new Date(2026, 0, 1));
  const ouro = diasDeOuro(mes, 5);

  assert.ok(ouro.length <= 5);
  assert.ok(ouro.every((d) => d.ouro));
  for (let i = 1; i < ouro.length; i++) {
    assert.ok(ouro[i - 1].destaque!.nota >= ouro[i].destaque!.nota);
  }
});
