import crypto from 'crypto';
import fs from 'fs';

/**
 * Gera o arquivo de licença **assinado** — o que liga e desliga a aplicação.
 *
 * ```
 * npm run licenca -- gerar-chaves          # uma vez, e guarde a privada
 * npm run licenca -- ativa
 * npm run licenca -- avisando "mensagem visível para os clientes"
 * npm run licenca -- suspensa "mensagem"
 * ```
 *
 * O arquivo sai em `licenca.json`. Suba-o onde `LICENCA_URL` aponta — pode ser
 * GitHub Pages, um bucket, ou um arquivo estático em qualquer site seu. Não
 * precisa de servidor nem de banco.
 *
 * **A chave privada nunca entra no repositório da aplicação.** Ela fica com
 * quem licencia; o que viaja com o código é só a pública.
 */

const ARQUIVO = 'licenca.json';

function gerarChaves() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const publica = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const privada = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');

  console.log('\nChave PÚBLICA — vai no .env da aplicação entregue:\n');
  console.log(`LICENCA_CHAVE_PUBLICA=${publica}\n`);
  console.log('Chave PRIVADA — guarde fora do repositório, só você tem:\n');
  console.log(`LICENCA_CHAVE_PRIVADA=${privada}\n`);
}

function assinar(estado: string, mensagem?: string) {
  const privada = process.env.LICENCA_CHAVE_PRIVADA?.trim();
  if (!privada) {
    console.error('LICENCA_CHAVE_PRIVADA ausente. Rode `gerar-chaves` primeiro.');
    process.exit(1);
  }

  const conteudo = {
    estado,
    ...(mensagem ? { mensagem } : {}),
    /**
     * A data entra na assinatura de propósito: sem ela, uma resposta "ativa"
     * capturada hoje poderia ser reapresentada para sempre por quem quisesse
     * ignorar uma suspensão futura.
     */
    emitida_em: new Date().toISOString(),
  };

  const chave = crypto.createPrivateKey({
    key: Buffer.from(privada, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });

  const assinatura = crypto
    .sign(null, Buffer.from(JSON.stringify(conteudo)), chave)
    .toString('base64');

  fs.writeFileSync(ARQUIVO, JSON.stringify({ ...conteudo, assinatura }, null, 2));
  console.log(`${ARQUIVO} gerado — estado: ${estado}`);
  console.log('Suba este arquivo no endereço de LICENCA_URL.');
}

const acao = process.argv[2];

if (acao === 'gerar-chaves') {
  gerarChaves();
} else if (acao === 'ativa' || acao === 'avisando' || acao === 'suspensa') {
  assinar(acao, process.argv[3]);
} else {
  console.log('uso: npm run licenca -- gerar-chaves | ativa | avisando "msg" | suspensa "msg"');
}
