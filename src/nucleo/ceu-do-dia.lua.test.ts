import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ceuDoDia } from './ceu-do-dia';

/**
 * A geometria do desenho da lua, verificada por área.
 *
 * `LuaDesenhada` é um componente React e não dá para renderizar aqui, mas a
 * decisão que importa nele é puramente aritmética: qual lado o terminador
 * recorta. Este teste reimplementa **a mesma fórmula** e confere que a área
 * resultante bate com a fração iluminada de verdade.
 *
 * Existe porque o erro que ele pega é invisível: trocar o sinal desenha 15%
 * de luz onde deveria haver 85%, e a tela continua mostrando uma lua bonita —
 * só que errada, e só quem comparar com o céu percebe.
 */
function areaIluminadaDoDesenho(fase: number): number {
  const r = 50;
  const cosseno = Math.cos((fase * Math.PI) / 180);
  const rx = Math.abs(cosseno) * r;

  const crescendo = fase < 180;
  const terminadorRecortaAFoice = cosseno > 0;
  const varreduraTerminador = terminadorRecortaAFoice === crescendo ? 0 : 1;

  // Meio disco (πr²/2) mais ou menos a meia-elipse (π·rx·r/2). O sinal
  // depende de a barriga apontar para dentro ou para fora da metade acesa.
  const meioDisco = (Math.PI * r * r) / 2;
  const meiaElipse = (Math.PI * rx * r) / 2;

  const somaElipse = crescendo ? varreduraTerminador === 1 : varreduraTerminador === 0;
  const area = somaElipse ? meioDisco + meiaElipse : meioDisco - meiaElipse;

  return area / (Math.PI * r * r); // fração do disco
}

describe('desenho da lua', () => {
  test('quarto crescente desenha exatamente meia lua', () => {
    assert.ok(Math.abs(areaIluminadaDoDesenho(90) - 0.5) < 0.01);
  });

  test('quarto minguante desenha exatamente meia lua', () => {
    assert.ok(Math.abs(areaIluminadaDoDesenho(270) - 0.5) < 0.01);
  });

  test('cheia desenha o disco inteiro', () => {
    assert.ok(areaIluminadaDoDesenho(180) > 0.99);
  });

  test('crescente fina desenha FOICE, não giba — o erro que passa despercebido', () => {
    const area = areaIluminadaDoDesenho(45);
    assert.ok(area < 0.25, `45° deveria ser foice fina, desenhou ${(area * 100).toFixed(0)}%`);
  });

  test('gibosa crescente desenha giba, não foice', () => {
    const area = areaIluminadaDoDesenho(135);
    assert.ok(area > 0.75, `135° deveria ser gibosa, desenhou ${(area * 100).toFixed(0)}%`);
  });

  test('minguante fina desenha foice', () => {
    assert.ok(areaIluminadaDoDesenho(315) < 0.25);
  });

  test('a área desenhada acompanha a iluminação real em todo o ciclo', () => {
    for (let fase = 10; fase < 350; fase += 10) {
      const real = (1 - Math.cos((fase * Math.PI) / 180)) / 2;
      const desenhada = areaIluminadaDoDesenho(fase);
      assert.ok(
        Math.abs(real - desenhada) < 0.02,
        `${fase}°: real ${(real * 100).toFixed(0)}%, desenhado ${(desenhada * 100).toFixed(0)}%`
      );
    }
  });
});

describe('ceuDoDia expõe o que o desenho precisa', () => {
  test('grausDaFase fica em 0–360 e iluminação em 0–1', () => {
    for (let dia = 0; dia < 40; dia++) {
      const ceu = ceuDoDia(new Date(2026, 7, 1 + dia));
      assert.ok(ceu.grausDaFase >= 0 && ceu.grausDaFase < 360);
      assert.ok(ceu.iluminacao >= 0 && ceu.iluminacao <= 1);
    }
  });

  test('iluminação bate com a fase nomeada', () => {
    for (let dia = 0; dia < 40; dia++) {
      const ceu = ceuDoDia(new Date(2026, 7, 1 + dia));
      if (ceu.faseDaLua === 'cheia') assert.ok(ceu.iluminacao > 0.5);
      if (ceu.faseDaLua === 'nova') assert.ok(ceu.iluminacao < 0.5);
    }
  });
});
