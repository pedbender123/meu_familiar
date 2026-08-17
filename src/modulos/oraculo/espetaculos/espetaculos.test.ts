import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { cartas } from './cartas';
import { ceu } from './ceu';
import { sortearEspetaculos, ESPETACULOS } from './index';
import { geradorDe, sortearSemRepetir, type ContextoDoEspetaculo } from './tipos';
import { mapaNatal } from '../../calendario/transitos';

const NATAL = mapaNatal({
  data: '1994-11-08',
  hora: '03:20',
  lat: -23.5505,
  lon: -46.6333,
  horaAproximada: false,
});

function ctx(sobrescreve: Partial<ContextoDoEspetaculo> = {}): ContextoDoEspetaculo {
  return {
    semente: 'semente-fixa',
    diaDeOuro: false,
    quando: new Date('2026-08-17T15:00:00Z'),
    natal: NATAL,
    ...sobrescreve,
  };
}

describe('gerador determinístico', () => {
  test('a mesma semente devolve a mesma sequência', () => {
    const a = geradorDe('x');
    const b = geradorDe('x');
    for (let i = 0; i < 10; i++) assert.equal(a(), b());
  });

  test('sementes diferentes divergem', () => {
    assert.notEqual(geradorDe('x')(), geradorDe('y')());
  });

  test('sempre entre 0 e 1', () => {
    const g = geradorDe('teste');
    for (let i = 0; i < 500; i++) {
      const v = g();
      assert.ok(v >= 0 && v < 1, `saiu da faixa: ${v}`);
    }
  });

  test('sortearSemRepetir não repete', () => {
    const itens = [1, 2, 3, 4, 5];
    const escolhidos = sortearSemRepetir(itens, 5, geradorDe('s'));
    assert.equal(new Set(escolhidos).size, 5);
  });

  test('pedir mais do que existe devolve o que tem, sem quebrar', () => {
    assert.equal(sortearSemRepetir([1, 2], 10, geradorDe('s')).length, 2);
  });
});

describe('as cartas', () => {
  test('tira 3 em dia comum', () => {
    const r = cartas.executar(ctx());
    assert.equal(r.simbolos.length, 3);
    assert.ok(r.simbolos.every((s) => !s.dourado));
  });

  test('tira 4 em dia de ouro, e a quarta é a dourada', () => {
    const r = cartas.executar(ctx({ diaDeOuro: true }));
    assert.equal(r.simbolos.length, 4);
    assert.equal(r.simbolos[3].dourado, true);
    assert.equal(r.simbolos[3].posicao, 'o presente do dia');
  });

  test('o bônus ACRESCENTA — as três primeiras cartas são as mesmas', () => {
    const comum = cartas.executar(ctx());
    const ouro = cartas.executar(ctx({ diaDeOuro: true }));

    // Mesma semente, mesmo sorteio: o dia de ouro não pode trocar a leitura,
    // só somar. Senão a pessoa teria uma leitura DIFERENTE, não melhor.
    for (let i = 0; i < 3; i++) {
      assert.equal(comum.simbolos[i].nome, ouro.simbolos[i].nome);
    }
  });

  test('nunca repete carta na mesma tiragem', () => {
    for (let i = 0; i < 100; i++) {
      const r = cartas.executar(ctx({ semente: `s${i}`, diaDeOuro: true }));
      assert.equal(new Set(r.simbolos.map((s) => s.nome)).size, r.simbolos.length);
    }
  });

  test('é reproduzível: mesma semente, mesmas cartas', () => {
    const a = cartas.executar(ctx({ semente: 'abc' }));
    const b = cartas.executar(ctx({ semente: 'abc' }));
    assert.deepEqual(
      a.simbolos.map((s) => s.nome),
      b.simbolos.map((s) => s.nome)
    );
  });

  test('sementes diferentes dão tiragens diferentes', () => {
    const tiragens = new Set(
      Array.from({ length: 30 }, (_, i) =>
        cartas
          .executar(ctx({ semente: `s${i}` }))
          .simbolos.map((s) => s.nome)
          .join('|')
      )
    );
    assert.ok(tiragens.size > 25, `esperava variedade, vieram ${tiragens.size}`);
  });

  test('todo símbolo tem nome, posição e sentido — a IA precisa dos três', () => {
    const r = cartas.executar(ctx({ diaDeOuro: true }));
    for (const s of r.simbolos) {
      assert.ok(s.nome.length > 2);
      assert.ok(s.posicao.length > 3);
      assert.ok(s.sentido.length > 10, `sem sentido a IA inventa: ${s.nome}`);
    }
  });
});

describe('o céu', () => {
  test('devolve aspectos reais contra o mapa natal', () => {
    const r = ceu.executar(ctx());
    assert.ok(r.simbolos.length >= 1);
    assert.ok(r.cena.posicoes);
  });

  test('não é sorteado: a mesma data devolve o mesmo céu, com qualquer semente', () => {
    const a = ceu.executar(ctx({ semente: 'aaa' }));
    const b = ceu.executar(ctx({ semente: 'zzz' }));
    assert.deepEqual(
      a.simbolos.filter((s) => !s.dourado).map((s) => s.nome),
      b.simbolos.filter((s) => !s.dourado).map((s) => s.nome)
    );
  });

  test('datas diferentes dão céus diferentes', () => {
    const agosto = ceu.executar(ctx({ quando: new Date('2026-08-17T15:00:00Z') }));
    const dezembro = ceu.executar(ctx({ quando: new Date('2026-12-17T15:00:00Z') }));
    assert.notDeepEqual(
      agosto.simbolos.map((s) => s.nome),
      dezembro.simbolos.map((s) => s.nome)
    );
  });

  test('sem mapa natal ainda funciona — não barra quem não preencheu o nascimento', () => {
    const r = ceu.executar(ctx({ natal: null }));
    assert.ok(r.simbolos.length >= 1);
    assert.ok(r.simbolos[0].nome.includes('Lua'));
  });

  test('dia de ouro acende a Constelação da Fortuna', () => {
    const r = ceu.executar(ctx({ diaDeOuro: true }));
    const dourado = r.simbolos.filter((s) => s.dourado);
    assert.equal(dourado.length, 1);
    assert.match(dourado[0].posicao, /Fortuna/);
  });

  test('no máximo 2 aspectos + o bônus — mais que isso vira ruído', () => {
    for (let i = 0; i < 20; i++) {
      const r = ceu.executar(
        ctx({ quando: new Date(2026, i % 12, 1 + i), diaDeOuro: true })
      );
      assert.ok(r.simbolos.length <= 3, `vieram ${r.simbolos.length} símbolos`);
    }
  });
});

describe('sorteio do elenco', () => {
  test('sorteia dois espetáculos', () => {
    const r = sortearEspetaculos(ctx());
    assert.equal(r.length, Math.min(2, ESPETACULOS.length));
  });

  test('não repete o mesmo espetáculo na mesma leitura', () => {
    for (let i = 0; i < 50; i++) {
      const r = sortearEspetaculos(ctx({ semente: `s${i}` }));
      assert.equal(new Set(r.map((x) => x.espetaculo)).size, r.length);
    }
  });

  test('é reproduzível pela semente — reabrir a leitura mostra o mesmo show', () => {
    const a = sortearEspetaculos(ctx({ semente: 'fixa' }));
    const b = sortearEspetaculos(ctx({ semente: 'fixa' }));
    assert.deepEqual(
      a.map((x) => `${x.espetaculo}:${x.simbolos.map((s) => s.nome).join(',')}`),
      b.map((x) => `${x.espetaculo}:${x.simbolos.map((s) => s.nome).join(',')}`)
    );
  });

  test('a ordem varia entre leituras — é par ORDENADO, não combinação', () => {
    const ordens = new Set(
      Array.from({ length: 40 }, (_, i) =>
        sortearEspetaculos(ctx({ semente: `s${i}` }))
          .map((x) => x.espetaculo)
          .join('>')
      )
    );
    assert.ok(ordens.size > 1, 'a ordem deveria variar');
  });

  test('todo espetáculo do elenco tem duração declarada', () => {
    for (const e of ESPETACULOS) {
      assert.ok(e.duracaoMs > 5000, `${e.id} precisa de tempo pra cobrir a latência`);
    }
  });
});
