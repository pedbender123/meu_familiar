import test from 'node:test';
import assert from 'node:assert/strict';
import {
  desde,
  ehJanela,
  normalizarOrigem,
  origemDoReferer,
} from './analitica';

/**
 * O que se testa aqui é o que **mente sem avisar**.
 *
 * Um gráfico errado não quebra: ele desenha uma linha convincente e você toma
 * decisão de divulgação em cima dela. Fuso horário e atribuição de origem são
 * os dois lugares onde esse tipo de erro nasce.
 */

test('a origem só aceita a lista fechada; o resto vira "outro"', () => {
  assert.equal(normalizarOrigem('tiktok'), 'tiktok');
  assert.equal(normalizarOrigem('INSTAGRAM'), 'instagram');
  assert.equal(normalizarOrigem('qualquer-coisa'), 'outro');
});

test('a origem não deixa passar injeção pela URL', () => {
  // O painel renderiza esse valor numa tabela. Um `?de=<script>` que chegasse
  // inteiro até lá seria XSS armazenado, disparado no navegador do dono.
  assert.equal(normalizarOrigem('<script>alert(1)</script>'), 'outro');
  assert.equal(normalizarOrigem("'; DROP TABLE visitas;--"), 'outro');
  assert.ok(!normalizarOrigem('a'.repeat(500))!.includes('a'.repeat(50)));
});

test('origem vazia é null, não string vazia', () => {
  // String vazia viraria uma linha fantasma na tabela de origens.
  for (const v of ['', '   ', '!!!', null, undefined]) {
    assert.equal(normalizarOrigem(v), null, `falhou em ${JSON.stringify(v)}`);
  }
});

test('o referer reconhece as redes que importam', () => {
  assert.equal(origemDoReferer('https://www.tiktok.com/@alguem'), 'tiktok');
  assert.equal(origemDoReferer('https://l.instagram.com/?u=x'), 'instagram');
  assert.equal(origemDoReferer('https://youtu.be/abc'), 'youtube');
  assert.equal(origemDoReferer('https://algumblog.com/post'), 'outro');
});

test('navegação interna NÃO conta como origem', () => {
  // Sem isto, cada clique dentro do site sobrescreveria a origem verdadeira e
  // toda venda apareceria vindo do próprio bruxario.com.br.
  assert.equal(origemDoReferer('https://bruxario.com.br/ritual'), null);
  assert.equal(origemDoReferer('https://www.bruxario.com.br/'), null);
});

test('referer malformado não derruba nada', () => {
  for (const lixo of ['', 'nao-e-url', 'javascript:alert(1)', null, undefined]) {
    assert.doesNotThrow(() => origemDoReferer(lixo));
  }
});

test('"hoje" é a meia-noite de Brasília, não as últimas 24h', () => {
  // 1º de agosto, 02:00 UTC = 31 de julho, 23:00 em Brasília. "Hoje" tem que
  // ser o dia 31, senão o painel aberto de madrugada mostra zero e assusta.
  const agora = new Date('2026-08-01T02:00:00.000Z');
  assert.equal(desde('hoje', agora), '2026-07-31T03:00:00.000Z');
});

test('"hoje" logo depois da virada de Brasília começa no dia novo', () => {
  // 1º de agosto, 04:00 UTC = 01:00 em Brasília: já é dia 1º.
  const agora = new Date('2026-08-01T04:00:00.000Z');
  assert.equal(desde('hoje', agora), '2026-08-01T03:00:00.000Z');
});

test('as janelas em dias contam para trás a partir de agora', () => {
  const agora = new Date('2026-08-10T12:00:00.000Z');
  assert.equal(desde('7d', agora), '2026-08-03T12:00:00.000Z');
  assert.equal(desde('30d', agora), '2026-07-11T12:00:00.000Z');
});

test('"tudo" não filtra nada', () => {
  assert.equal(desde('tudo'), null);
});

test('janela inválida é rejeitada em vez de virar SQL', () => {
  assert.ok(ehJanela('7d'));
  assert.ok(!ehJanela('7 dias'));
  assert.ok(!ehJanela("1' OR '1'='1"));
  assert.ok(!ehJanela(undefined));
});
