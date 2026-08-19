import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { escadaDaOferta, PLANOS_DA_OFERTA, ehPlanoDaOferta } from './oferta';
import type { Direitos } from './direitos';

/**
 * A tela de oferta diz "tudo do anterior, e:" em cada degrau, e lista os
 * ganhos com texto escrito à mão. As duas coisas são promessas — e promessa
 * escrita à mão ao lado de direito guardado no banco é exatamente onde a
 * página de vendas começa a mentir sem ninguém perceber.
 *
 * Estes testes são o que impede isso.
 */

const FORCA_DO_ALCANCE: Record<string, number> = {
  nenhum: 0,
  hoje: 1,
  semana: 2,
  mes: 3,
  semestre: 4,
  ano: 5,
  rolante: 6,
};

describe('a escada da oferta', () => {
  test('tem os três degraus, na ordem em que a decisão fica fácil', () => {
    const escada = escadaDaOferta();
    assert.deepEqual(
      escada.map((i) => i.plano.id),
      ['avulsa_simples', 'avulsa_completa', 'revelacao_mensal']
    );
  });

  test('a recorrente é a última, e é a única', () => {
    const escada = escadaDaOferta();
    const recorrentes = escada.filter((i) => i.recorrente);
    assert.equal(recorrentes.length, 1, 'só uma recorrente nesta tela');
    assert.equal(recorrentes[0].plano.id, escada[escada.length - 1].plano.id);
  });

  test('o preço sobe a cada degrau', () => {
    const precos = escadaDaOferta().map((i) => i.plano.preco_centavos);
    for (let i = 1; i < precos.length; i++) {
      assert.ok(
        precos[i] > precos[i - 1],
        `degrau ${i} custa ${precos[i]}, não mais que o anterior (${precos[i - 1]})`
      );
    }
  });

  /**
   * O invariante que sustenta a frase "tudo do anterior, e:".
   *
   * Sem ele, alguém corta uma cota num degrau de cima numa migração futura, a
   * tela continua dizendo que ele tem tudo do de baixo, e a pessoa paga mais
   * por menos.
   */
  test('cada degrau entrega TUDO do anterior — a frase da tela é verdade', () => {
    const escada = escadaDaOferta();

    const booleanos: (keyof Direitos)[] = [
      'pdf',
      'imagens',
      'relatorioCompleto',
      'graficos',
      'perfilPublico',
      'tiragemDiaria',
      'narracaoAudio',
      'perfilCompleto',
      'oraculoNaHora',
      'conselhoDiario',
      'guiaPorEmail',
    ];
    const numericos: (keyof Direitos)[] = [
      'perguntasOraculo',
      'perguntasOraculoPorDia',
      'leiturasPorMes',
    ];

    for (let i = 1; i < escada.length; i++) {
      const antes = escada[i - 1];
      const agora = escada[i];

      for (const campo of booleanos) {
        if (antes.direitos[campo]) {
          assert.ok(
            agora.direitos[campo],
            `${agora.plano.id} perdeu "${campo}", que ${antes.plano.id} tem`
          );
        }
      }

      for (const campo of numericos) {
        assert.ok(
          (agora.direitos[campo] as number) >= (antes.direitos[campo] as number),
          `${agora.plano.id} tem menos "${campo}" que ${antes.plano.id}`
        );
      }

      assert.ok(
        FORCA_DO_ALCANCE[agora.direitos.alcanceCalendario] >=
          FORCA_DO_ALCANCE[antes.direitos.alcanceCalendario],
        `${agora.plano.id} alcança menos calendário que ${antes.plano.id}`
      );
    }
  });

  /**
   * Cada linha escrita à mão contra o direito que a sustenta. Se um número
   * mudar no banco e o texto ficar, isto quebra — que é o ponto.
   */
  test('nenhuma linha da tela promete o que os direitos não liberam', () => {
    const porId = new Map(escadaDaOferta().map((i) => [i.plano.id, i]));

    const simples = porId.get('avulsa_simples')!;
    assert.equal(simples.direitos.pdf, true, 'promete PDF e imagens para baixar');
    assert.equal(simples.direitos.alcanceCalendario, 'semana', 'promete a semana inteira');

    const completa = porId.get('avulsa_completa')!;
    assert.equal(completa.direitos.relatorioCompleto, true, 'promete o relatório longo');
    assert.equal(completa.direitos.graficos, true, 'promete os gráficos dos eixos');
    assert.equal(completa.direitos.narracaoAudio, true, 'promete a narração em áudio');

    const mensal = porId.get('revelacao_mensal')!;
    assert.ok(mensal.direitos.leiturasPorMes >= 10, 'promete 10 leituras por mês');
    assert.ok(mensal.direitos.perguntasOraculo >= 60, 'promete 60 mensagens');
    assert.equal(mensal.direitos.oraculoNaHora, true, 'promete resposta na hora');
    assert.equal(mensal.direitos.alcanceCalendario, 'semestre', 'promete 6 meses');
    assert.equal(mensal.direitos.guiaPorEmail, true, 'promete o guia por e-mail');
  });

  test('as avulsas não expiram — foi decisão explícita, não descuido', () => {
    for (const item of escadaDaOferta()) {
      if (item.recorrente) continue;
      assert.equal(
        item.plano.duracao_dias,
        null,
        `${item.plano.id} ganhou prazo: compra avulsa que expira é origem de estorno`
      );
    }
  });

  test('ehPlanoDaOferta só reconhece os três — é o portão de `origem: oferta`', () => {
    for (const id of PLANOS_DA_OFERTA) assert.ok(ehPlanoDaOferta(id));
    for (const id of ['gratuito', 'conselho', 'vigilia', 'revelacao_anual', 'completa']) {
      assert.equal(ehPlanoDaOferta(id), false, `${id} não pode entrar pela oferta`);
    }
  });
});
