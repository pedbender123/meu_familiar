import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ITENS, TOTAL_DE_ITENS } from './itens';
import { EIXOS } from './eixos';
import {
  ANGULO_DO_FAMILIAR,
  FAMILIARES_NO_CIRCULO,
  afinidades,
  distanciaAngular,
  paraPolar,
} from './circulo';
import {
  pontuar,
  somarCargas,
  normalizacaoTeorica,
  LIMIAR_DE_EMPATE,
  type Respostas,
} from './pontuacao';
import { FAMILIARES } from '../familiares';

/* ───────────────────────── o banco de itens ───────────────────────────── */

describe('banco de itens', () => {
  test('tem os 26 itens que o SPEC 2.3 pede', () => {
    assert.equal(TOTAL_DE_ITENS, 26);
  });

  test('a composição por eixo bate com o SPEC (8/8/5/5)', () => {
    const porEixo = ITENS.reduce<Record<string, number>>((acc, i) => {
      acc[i.eixo] = (acc[i.eixo] ?? 0) + 1;
      return acc;
    }, {});
    assert.deepEqual(porEixo, {
      agencia: 8,
      comunhao: 8,
      abertura: 5,
      estabilidade: 5,
    });
  });

  test('todo item tem exatamente 4 opções e id único', () => {
    const ids = new Set<string>();
    for (const item of ITENS) {
      assert.equal(item.opcoes.length, 4, `${item.id} não tem 4 opções`);
      assert.ok(!ids.has(item.id), `id repetido: ${item.id}`);
      ids.add(item.id);
    }
  });

  test('nenhuma carga escapa de [-1, +1]', () => {
    for (const item of ITENS) {
      for (const [i, opcao] of item.opcoes.entries()) {
        for (const eixo of EIXOS) {
          const carga = opcao.cargas[eixo] ?? 0;
          assert.ok(
            carga >= -1 && carga <= 1,
            `${item.id} opção ${i} eixo ${eixo}: ${carga} fora de [-1,1]`
          );
        }
      }
    }
  });

  test('toda opção mexe em pelo menos um eixo', () => {
    for (const item of ITENS) {
      for (const [i, opcao] of item.opcoes.entries()) {
        const soma = EIXOS.reduce((a, e) => a + Math.abs(opcao.cargas[e] ?? 0), 0);
        assert.ok(soma > 0, `${item.id} opção ${i} não carrega nada`);
      }
    }
  });

  test('cada item discrimina de fato o eixo que diz discriminar', () => {
    // se as 4 opções carregam quase o mesmo no eixo declarado, o item não
    // separa ninguém — é peso morto no teste
    for (const item of ITENS) {
      const cargas = item.opcoes.map((o) => o.cargas[item.eixo] ?? 0);
      const amplitude = Math.max(...cargas) - Math.min(...cargas);
      assert.ok(
        amplitude >= 0.8,
        `${item.id} varia só ${amplitude.toFixed(2)} em ${item.eixo}`
      );
    }
  });

  test('a posição da opção de carga mais alta é distribuída (efeito de ordem)', () => {
    // SPEC 2.6: quem sempre marca a primeira não pode sair com perfil
    // sistemático. A ordem também é embaralhada na exibição, mas o banco não
    // deve depender disso.
    const contagem = [0, 0, 0, 0];
    for (const item of ITENS) {
      const cargas = item.opcoes.map((o) => o.cargas[item.eixo] ?? 0);
      contagem[cargas.indexOf(Math.max(...cargas))] += 1;
    }
    for (const [posicao, n] of contagem.entries()) {
      assert.ok(
        n >= 2,
        `posição ${posicao} carrega o valor máximo em só ${n} itens: ${contagem}`
      );
    }
  });
});

/* ───────────────────────── o círculo ──────────────────────────────────── */

describe('circumplexo', () => {
  test('os 12 familiares estão no círculo, a 30° um do outro', () => {
    assert.equal(FAMILIARES_NO_CIRCULO.length, 12);
    const angulos = [...FAMILIARES_NO_CIRCULO]
      .map((f) => ANGULO_DO_FAMILIAR[f])
      .sort((a, b) => a - b);
    for (let i = 1; i < angulos.length; i++) {
      assert.equal(angulos[i] - angulos[i - 1], 30);
    }
  });

  test('todo familiar do produto tem posição no círculo', () => {
    for (const id of Object.keys(FAMILIARES)) {
      assert.ok(
        id in ANGULO_DO_FAMILIAR,
        `${id} existe em FAMILIARES mas não no círculo`
      );
    }
  });

  test('distância angular nunca passa de 180 e trata a virada do zero', () => {
    assert.equal(distanciaAngular(350, 10), 20);
    assert.equal(distanciaAngular(10, 350), 20);
    assert.equal(distanciaAngular(0, 180), 180);
    assert.equal(distanciaAngular(90, 90), 0);
  });

  test('afinidade devolve sempre os 12, ordenados, somando 100 no topo', () => {
    const lista = afinidades(ANGULO_DO_FAMILIAR.corvo);
    assert.equal(lista.length, 12);
    assert.equal(lista[0].familiar, 'corvo');
    assert.equal(lista[0].escore, 100);
    for (let i = 1; i < lista.length; i++) {
      assert.ok(lista[i].distancia >= lista[i - 1].distancia, 'fora de ordem');
    }
  });

  test('o familiar oposto no círculo tem afinidade zero', () => {
    // Raposa está em 0°, Morcego em 180° — são opostos por construção
    const lista = afinidades(ANGULO_DO_FAMILIAR.raposa);
    const morcego = lista.find((a) => a.familiar === 'morcego')!;
    assert.equal(morcego.escore, 0);
  });

  test('paraPolar concorda com os quadrantes', () => {
    assert.equal(Math.round(paraPolar(1, 0).angulo), 0); // pura agência
    assert.equal(Math.round(paraPolar(0, 1).angulo), 90); // pura comunhão
    assert.equal(Math.round(paraPolar(-1, 0).angulo), 180);
    assert.equal(Math.round(paraPolar(0, -1).angulo), 270);
  });
});

/* ───────────────────────── a pontuação ────────────────────────────────── */

/** Escolhe, em cada item, a opção de maior carga no eixo pedido. */
function respostasQueMaximizam(eixo: string, sinal: 1 | -1): Respostas {
  const r: Respostas = {};
  for (const item of ITENS) {
    const cargas = item.opcoes.map(
      (o) => sinal * (o.cargas[eixo as keyof typeof o.cargas] ?? 0)
    );
    r[item.id] = cargas.indexOf(Math.max(...cargas));
  }
  return r;
}

/** Sempre a opção da posição `i`. Serve para simular resposta preguiçosa. */
function sempreAPosicao(i: number): Respostas {
  return Object.fromEntries(ITENS.map((item) => [item.id, i]));
}

describe('pontuação', () => {
  test('soma de cargas ignora item não respondido', () => {
    const parcial: Respostas = { q01: 0 };
    const bruto = somarCargas(parcial);
    assert.equal(bruto.agencia, ITENS[0].opcoes[0].cargas.agencia);
  });

  test('índice de opção inválido não quebra nem contamina', () => {
    const bruto = somarCargas({ q01: 99, q02: -1 });
    for (const eixo of EIXOS) assert.equal(bruto[eixo], 0);
  });

  test('a normalização teórica tem desvio positivo em todo eixo', () => {
    const norma = normalizacaoTeorica();
    for (const eixo of EIXOS) {
      assert.ok(norma.desvio[eixo] > 0, `desvio zerado em ${eixo}`);
      assert.ok(Number.isFinite(norma.media[eixo]), `média inválida em ${eixo}`);
    }
    assert.equal(norma.origem, 'teorica');
  });

  test('quem maximiza agência cai num familiar de alta agência', () => {
    const r = pontuar(respostasQueMaximizam('agencia', 1));
    // 0° é Raposa, 30° Lebre, 330° Corvo — a faixa de alta agência
    assert.ok(
      distanciaAngular(r.angulo, 0) <= 45,
      `ângulo ${r.angulo.toFixed(1)}° não é de alta agência`
    );
    assert.ok(['raposa', 'lebre', 'corvo', 'lobo'].includes(r.familiar), r.familiar);
  });

  test('quem maximiza comunhão cai num familiar caloroso', () => {
    const r = pontuar(respostasQueMaximizam('comunhao', 1));
    assert.ok(
      distanciaAngular(r.angulo, 90) <= 45,
      `ângulo ${r.angulo.toFixed(1)}° não é de alta comunhão`
    );
    assert.ok(['cervo', 'lobo', 'mariposa', 'sapo'].includes(r.familiar), r.familiar);
  });

  test('minimizar um eixo leva para o lado oposto do círculo', () => {
    const alta = pontuar(respostasQueMaximizam('comunhao', 1));
    const baixa = pontuar(respostasQueMaximizam('comunhao', -1));
    assert.ok(
      distanciaAngular(alta.angulo, baixa.angulo) > 120,
      'alta e baixa comunhão deveriam cair em lados opostos'
    );
  });

  test('sempre devolve os 12 escores, não só o vencedor (SPEC 0.8)', () => {
    const r = pontuar(respostasQueMaximizam('agencia', 1));
    assert.equal(r.afinidades.length, 12);
    assert.equal(r.afinidades[0].familiar, r.familiar);
    const nomes = new Set(r.afinidades.map((a) => a.familiar));
    assert.equal(nomes.size, 12, 'familiar repetido no ranking');
  });

  test('o resultado é determinístico', () => {
    const r = respostasQueMaximizam('agencia', 1);
    assert.deepEqual(pontuar(r).afinidades, pontuar(r).afinidades);
  });

  test('empate só é sinalizado dentro do limiar', () => {
    const r = pontuar(respostasQueMaximizam('agencia', 1));
    if (r.empate) {
      assert.ok(r.empate.diferenca < LIMIAR_DE_EMPATE);
      assert.notEqual(r.empate.entre[0], r.empate.entre[1]);
    }
    const diferencaReal = r.afinidades[1].distancia - r.afinidades[0].distancia;
    assert.equal(r.empate !== null, diferencaReal < LIMIAR_DE_EMPATE);
  });

  test('o signo NÃO entra na conta (SPEC 2.4, travado)', () => {
    // Guarda estrutural: o motor não pode nem ter acesso ao signo. Uma
    // asserção sobre o resultado não pegaria isso — só pegaria depois de o
    // dano estar feito. Se alguém importar astro/zodiaco aqui, quebra na hora.
    const fonte = readFileSync(new URL('./pontuacao.ts', import.meta.url), 'utf8');
    const circulo = readFileSync(new URL('./circulo.ts', import.meta.url), 'utf8');

    for (const [nome, codigo] of [
      ['pontuacao.ts', fonte],
      ['circulo.ts', circulo],
    ] as const) {
      const semComentarios = codigo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '');
      assert.ok(
        !/from ['\"].*(astro|zodiaco)/.test(semComentarios),
        `${nome} importa astro/zodiaco — o signo tem peso ZERO`
      );
      assert.ok(
        !/\bsigno/i.test(semComentarios),
        `${nome} menciona signo fora de comentário`
      );
    }

    // e o único parâmetro obrigatório continua sendo as respostas
    assert.equal(pontuar.length, 1);
  });
});

/* ─────────── a propriedade que o motor antigo não tinha ───────────────── */

describe('distribuição sobre a base (SPEC 2.5)', () => {
  /**
   * O motor antigo produzia empates o tempo todo, e o desempate pelo signo
   * virava o critério de fato. Estes testes fixam a propriedade oposta: o
   * resultado varia de verdade conforme as respostas.
   */
  test('respostas diferentes produzem familiares diferentes', () => {
    const encontrados = new Set([
      pontuar(respostasQueMaximizam('agencia', 1)).familiar,
      pontuar(respostasQueMaximizam('agencia', -1)).familiar,
      pontuar(respostasQueMaximizam('comunhao', 1)).familiar,
      pontuar(respostasQueMaximizam('comunhao', -1)).familiar,
    ]);
    assert.ok(encontrados.size >= 4, `só ${encontrados.size} distintos`);
  });

  test('responder tudo na mesma posição não trava sempre no mesmo bicho', () => {
    const porPosicao = [0, 1, 2, 3].map((i) => pontuar(sempreAPosicao(i)).familiar);
    assert.ok(
      new Set(porPosicao).size >= 3,
      `resposta preguiçosa cai quase sempre no mesmo: ${porPosicao.join(', ')}`
    );
  });

  test('uma varredura aleatória cobre boa parte dos 12', () => {
    // Não é validação psicométrica de verdade — isso exige gente respondendo
    // (SPEC 2.5). É um alarme contra o caso feio: um posicionamento que torna
    // metade dos familiares inalcançável.
    let semente = 42;
    const aleatorio = () => {
      semente = (semente * 1103515245 + 12345) % 2147483648;
      return semente / 2147483648;
    };

    const contagem = new Map<string, number>();
    const AMOSTRAS = 3000;
    for (let n = 0; n < AMOSTRAS; n++) {
      const r: Respostas = {};
      for (const item of ITENS) r[item.id] = Math.floor(aleatorio() * 4);
      const f = pontuar(r).familiar;
      contagem.set(f, (contagem.get(f) ?? 0) + 1);
    }

    const alcancados = contagem.size;
    assert.ok(
      alcancados >= 8,
      `só ${alcancados} dos 12 familiares são alcançáveis: ` +
        JSON.stringify(Object.fromEntries(contagem))
    );
  });
});
