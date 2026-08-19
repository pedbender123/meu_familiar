import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { criarPedido } from '@/lib/db';
import { garantirConta } from '@/lib/autenticacao';
import { herdarNascimentoDosPedidos, perfilAstralDaConta } from './perfil-astral';

/**
 * O ritual passou a perguntar a CIDADE (18/08). Estes testes travam a
 * consequência: a conta nasce completa e a pendência de mapa natal some
 * sozinha para quem entra pelo funil novo.
 *
 * Sem isso, a regressão é silenciosa e cara — o formulário continua
 * perguntando o lugar, a herança continua ignorando, e todo mundo que acabou
 * de digitar a cidade é recebido na plataforma por um aviso pedindo a cidade.
 */

function pedidoCom(email: string, respostas: Record<string, unknown>) {
  criarPedido({
    id: randomUUID(),
    nome: 'Teste',
    email,
    respostas_json: JSON.stringify(respostas),
    familiar: 'corvo',
    lua: 'cheia',
    signo_sol: 'aries',
    signo_lua: 'aries',
    produto: 'revelacao',
  });
}

test('a cidade e o estado do ritual viram lugar de nascimento na conta', () => {
  const email = `cidade-${randomUUID()}@bruxario.local`;
  const conta = garantirConta(email);
  pedidoCom(email, {
    quiz: {},
    dataNascimento: '1990-04-02',
    horaNascimento: '07:30',
    cidadeNascimento: 'Sorocaba',
    estadoNascimento: 'SP',
  });

  herdarNascimentoDosPedidos(conta.id, email);
  const { dados } = perfilAstralDaConta(conta.id);

  assert.equal(dados.data, '1990-04-02');
  assert.equal(dados.hora, '07:30');
  assert.equal(dados.cidade, 'Sorocaba · SP');
  // A coordenada é a da CAPITAL do estado, de propósito — ver `coordenadas.ts`.
  assert.ok(dados.lat !== null && dados.lon !== null);
  assert.ok(Math.abs(dados.lat! - -23.5505) < 0.5, 'latitude perto de São Paulo');
});

test('sigla de estado inventada não grava lugar nenhum, em vez de gravar zero', () => {
  const email = `sigla-${randomUUID()}@bruxario.local`;
  const conta = garantirConta(email);
  pedidoCom(email, {
    quiz: {},
    dataNascimento: '1990-04-02',
    cidadeNascimento: 'Atlântida',
    estadoNascimento: 'ZZ',
  });

  herdarNascimentoDosPedidos(conta.id, email);
  const { dados } = perfilAstralDaConta(conta.id);

  assert.equal(dados.cidade, null);
  assert.equal(dados.lat, null);
  assert.equal(dados.lon, null);
});

test('ritual sem hora marca a hora como aproximada, e não como conhecida', () => {
  const email = `sem-hora-${randomUUID()}@bruxario.local`;
  const conta = garantirConta(email);
  pedidoCom(email, {
    quiz: {},
    dataNascimento: '1990-04-02',
    cidadeNascimento: 'Recife',
    estadoNascimento: 'PE',
  });

  herdarNascimentoDosPedidos(conta.id, email);
  const { dados } = perfilAstralDaConta(conta.id);

  assert.equal(dados.hora, null);
  assert.equal(dados.horaAproximada, true);
});
