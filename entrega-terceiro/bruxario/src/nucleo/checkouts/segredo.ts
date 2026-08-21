import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * Cifra credenciais de checkout antes de gravar em `contas_checkout`.
 *
 * AES-256-GCM: autenticado (um `credenciais_cifradas` adulterado falha ao
 * decifrar em vez de devolver lixo), com IV aleatório por chamada (a mesma
 * credencial cifrada duas vezes produz saídas diferentes — não dá pra
 * comparar linhas cifradas pra adivinhar se duas contas usam o mesmo token).
 *
 * A chave nunca é o `APP_SECRET` cru: `scryptSync` deriva 32 bytes dele, que
 * é o tamanho que AES-256 exige e o `APP_SECRET` do `.env` não precisa ter.
 */
function chave(): Buffer {
  const segredo = process.env.APP_SECRET;
  if (!segredo) {
    throw new Error(
      'APP_SECRET não configurado — obrigatório para cifrar/decifrar credenciais de checkout.'
    );
  }
  return scryptSync(segredo, 'bruxario-contas-checkout', 32);
}

/** Formato gravado no banco: `iv:tag:ciphertext`, tudo em base64. */
export function cifrar(textoPuro: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  const ciphertext = Buffer.concat([cifra.update(textoPuro, 'utf8'), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decifrar(cifrado: string): string {
  const [ivB64, tagB64, ciphertextB64] = cifrado.split(':');
  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('credenciais_cifradas em formato inesperado (esperava iv:tag:ciphertext)');
  }
  const decifra = createDecipheriv('aes-256-gcm', chave(), Buffer.from(ivB64, 'base64'));
  decifra.setAuthTag(Buffer.from(tagB64, 'base64'));
  const textoPuro = Buffer.concat([
    decifra.update(Buffer.from(ciphertextB64, 'base64')),
    decifra.final(),
  ]);
  return textoPuro.toString('utf8');
}
