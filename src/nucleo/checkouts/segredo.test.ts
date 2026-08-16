import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cifrar, decifrar } from './segredo';

const SEGREDO_ORIGINAL = process.env.APP_SECRET;

beforeEach(() => {
  process.env.APP_SECRET = 'segredo-de-teste-nao-usar-em-producao';
});

afterEach(() => {
  process.env.APP_SECRET = SEGREDO_ORIGINAL;
});

describe('cifrar/decifrar', () => {
  test('decifra de volta o texto original', () => {
    const cifrado = cifrar('APP_USR-abc123');
    assert.equal(decifrar(cifrado), 'APP_USR-abc123');
  });

  test('a mesma entrada cifrada duas vezes produz saídas diferentes (IV aleatório)', () => {
    const a = cifrar('mesmo-token');
    const b = cifrar('mesmo-token');
    assert.notEqual(a, b);
    assert.equal(decifrar(a), 'mesmo-token');
    assert.equal(decifrar(b), 'mesmo-token');
  });

  test('sem APP_SECRET, lança em vez de cifrar com chave vazia', () => {
    delete process.env.APP_SECRET;
    assert.throws(() => cifrar('token'));
  });

  test('ciphertext adulterado falha ao decifrar em vez de devolver lixo', () => {
    const cifrado = cifrar('token-sensivel');
    const partes = cifrado.split(':');
    partes[2] = Buffer.from('adulterado').toString('base64');
    assert.throws(() => decifrar(partes.join(':')));
  });
});
