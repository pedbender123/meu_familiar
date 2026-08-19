import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import db from './db';
import {
  registrarAviso,
  desfazerAviso,
  jaAvisado,
  janelaDoDia,
  janelaDoMes,
} from './avisos';

beforeEach(() => {
  db.exec('DELETE FROM avisos_enviados');
});

describe('a trava de repetição', () => {
  /**
   * A razão de a tabela existir. O cron de hora em hora passa 24 vezes por
   * dia; o aviso é um por dia. Sem isto, a base inteira marca o domínio como
   * spam — e aí os e-mails que as pessoas ESPERAM param de chegar junto.
   */
  test('o segundo registro na mesma janela devolve false', () => {
    assert.equal(registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19'), true);
    assert.equal(registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19'), false);
  });

  test('vinte e quatro passagens do cron mandam UM aviso', () => {
    const enviados = Array.from({ length: 24 }, () =>
      registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19')
    ).filter(Boolean);
    assert.equal(enviados.length, 1);
  });

  test('janela nova libera de novo — é o dia seguinte, não uma repetição', () => {
    registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    assert.equal(registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-20'), true);
  });

  test('tipos diferentes não se atrapalham', () => {
    registrarAviso('dia_de_ouro', 'a@b.com', '2026-08');
    assert.equal(registrarAviso('cota_renovada', 'a@b.com', '2026-08'), true);
  });

  test('pessoas diferentes não se atrapalham', () => {
    registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    assert.equal(registrarAviso('dia_de_ouro', 'outra@b.com', '2026-08-19'), true);
  });

  test('o e-mail é normalizado — maiúscula não fura a trava', () => {
    registrarAviso('dia_de_ouro', 'Pessoa@Exemplo.com', '2026-08-19');
    assert.equal(registrarAviso('dia_de_ouro', ' pessoa@exemplo.COM ', '2026-08-19'), false);
  });
});

describe('desfazer', () => {
  /**
   * O script registra ANTES de enviar e desfaz se o envio falhar. Sem o
   * desfazer, uma falha de rede na Resend custaria o aviso daquela pessoa
   * para sempre — o registro diria que foi mandado.
   */
  test('depois de desfazer, a próxima passagem tenta de novo', () => {
    registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    assert.ok(jaAvisado('dia_de_ouro', 'a@b.com', '2026-08-19'));

    desfazerAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    assert.equal(jaAvisado('dia_de_ouro', 'a@b.com', '2026-08-19'), false);
    assert.equal(registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19'), true);
  });

  test('desfazer não derruba o aviso de outra pessoa', () => {
    registrarAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    registrarAviso('dia_de_ouro', 'b@b.com', '2026-08-19');
    desfazerAviso('dia_de_ouro', 'a@b.com', '2026-08-19');
    assert.ok(jaAvisado('dia_de_ouro', 'b@b.com', '2026-08-19'));
  });
});

describe('as janelas', () => {
  test('a diária muda a cada dia', () => {
    assert.equal(janelaDoDia(new Date(2026, 7, 19)), '2026-08-19');
    assert.notEqual(janelaDoDia(new Date(2026, 7, 19)), janelaDoDia(new Date(2026, 7, 20)));
  });

  test('a mensal é a mesma o mês inteiro', () => {
    assert.equal(janelaDoMes(new Date(2026, 7, 1)), '2026-08');
    assert.equal(janelaDoMes(new Date(2026, 7, 31)), '2026-08');
  });

  /** Fuso local, não UTC: às 21h do dia 19 em Brasília já é dia 20 em UTC. */
  test('a janela do dia usa o fuso local, não UTC', () => {
    assert.equal(janelaDoDia(new Date(2026, 7, 19, 21, 0, 0)), '2026-08-19');
  });
});
