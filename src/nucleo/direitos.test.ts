import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { unirDireitos, SEM_DIREITOS, type Direitos } from './direitos';

function direitos(sobrescreve: Partial<Direitos> = {}): Direitos {
  return { ...SEM_DIREITOS, ...sobrescreve };
}

test('lista vazia devolve SEM_DIREITOS', () => {
  assert.deepEqual(unirDireitos([]), SEM_DIREITOS);
});

test('uma assinatura só devolve exatamente os direitos dela', () => {
  const d = direitos({ pdf: true, graficos: true, perguntasOraculo: 10 });
  assert.deepEqual(unirDireitos([d]), d);
});

test('booleano é OU: uma assinatura que libera já libera, mesmo com outra que não libera', () => {
  const comGraficos = direitos({ graficos: true });
  const semGraficos = direitos({ graficos: false });
  assert.equal(unirDireitos([semGraficos, comGraficos]).graficos, true);
});

test('número é o MAIOR, não a soma — duas Completas não dobram as perguntas ao Oráculo', () => {
  const a = direitos({ perguntasOraculo: 10 });
  const b = direitos({ perguntasOraculo: 10 });
  assert.equal(unirDireitos([a, b]).perguntasOraculo, 10);
});

test('número é o maior entre valores DIFERENTES', () => {
  const revelacao = direitos({ perguntasOraculo: 0 });
  const completa = direitos({ perguntasOraculo: 10 });
  assert.equal(unirDireitos([revelacao, completa]).perguntasOraculo, 10);
});

test('todos os direitos da Completa somados aos da Revelação dão os da Completa (Revelação não tem nada exclusivo)', () => {
  const revelacao = direitos({ pdf: true, imagens: true });
  const completa = direitos({
    pdf: true,
    imagens: true,
    relatorioCompleto: true,
    graficos: true,
    perfilPublico: true,
    tiragemDiaria: true,
    perguntasOraculo: 10,
    narracaoAudio: true,
  });
  assert.deepEqual(unirDireitos([revelacao, completa]), completa);
});

describe('unirDireitos · alcance do calendário', () => {
  test('fica com o alcance mais longe, não com o último da lista', () => {
    const semana = { ...SEM_DIREITOS, alcanceCalendario: 'semana' as const };
    const ano = { ...SEM_DIREITOS, alcanceCalendario: 'ano' as const };
    assert.equal(unirDireitos([ano, semana]).alcanceCalendario, 'ano');
    assert.equal(unirDireitos([semana, ano]).alcanceCalendario, 'ano');
  });

  test('rolante ganha de todos', () => {
    const rolante = { ...SEM_DIREITOS, alcanceCalendario: 'rolante' as const };
    const mes = { ...SEM_DIREITOS, alcanceCalendario: 'mes' as const };
    assert.equal(unirDireitos([mes, rolante]).alcanceCalendario, 'rolante');
  });

  test('grátis + pago: a pessoa fica com o do pago em tudo', () => {
    const gratis = { ...SEM_DIREITOS, tiragemDiaria: true, perguntasOraculo: 3, alcanceCalendario: 'semana' as const };
    const pago = { ...SEM_DIREITOS, perfilCompleto: true, oraculoNaHora: true, perguntasOraculo: 10, alcanceCalendario: 'mes' as const };
    const u = unirDireitos([gratis, pago]);
    assert.equal(u.perguntasOraculo, 10);
    assert.equal(u.oraculoNaHora, true);
    assert.equal(u.perfilCompleto, true);
    assert.equal(u.alcanceCalendario, 'mes');
    assert.equal(u.tiragemDiaria, true, 'não perde o que o grátis dava');
  });
});
