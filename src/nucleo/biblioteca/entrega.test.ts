import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * O caminho entre pagar e ler.
 *
 * ── O buraco que estes testes fecham ──────────────────────────────────────
 *
 * O ebook é adicional de checkout, e o que a pessoa recebe não é arquivo: é
 * acesso a uma leitura dentro do app. Sem o e-mail, ela paga R$ 9,90 a mais,
 * vê "obrigado" na tela e não tem como chegar ao livro — teria que descobrir
 * sozinha que existe uma biblioteca. Isso não vira chamado de suporte, vira
 * estorno.
 */

const ENTREGA = readFileSync('src/nucleo/biblioteca/entrega.ts', 'utf8');
const VERIFICAR = readFileSync('src/app/entrar/verificar/route.ts', 'utf8');

describe('o aviso de que os livros chegaram', () => {
  test('o e-mail sai quando algum livro é liberado', () => {
    assert.match(ENTREGA, /void avisarQueChegou\(/);
    const trecho = ENTREGA.slice(ENTREGA.indexOf('if (entregues.length > 0)'));
    assert.ok(
      trecho.indexOf('avisarQueChegou') < trecho.indexOf('return entregues'),
      'o aviso acontece antes de a função devolver'
    );
  });

  /**
   * O direito já foi gravado quando o e-mail é tentado. Falhar ao avisar não
   * pode desfazer o que foi entregue — a pessoa continua dona e acha os
   * livros no próximo login.
   */
  test('falhar no e-mail não derruba a entrega', () => {
    const fn = ENTREGA.slice(ENTREGA.indexOf('async function avisarQueChegou'));
    assert.match(fn, /catch \(erro\)/, 'o erro é engolido');
    assert.doesNotMatch(fn.slice(0, fn.indexOf('catch')), /throw/);
  });

  /** Pedir senha a quem acabou de pagar é pôr uma porta na frente do produto. */
  test('o link do e-mail já entra logado, direto na biblioteca', () => {
    const fn = ENTREGA.slice(ENTREGA.indexOf('async function avisarQueChegou'));
    assert.match(fn, /criarTokenMagico\(email, 'conta'\)/);
    assert.match(fn, /destino=\$\{encodeURIComponent\('\/conta\/biblioteca'\)\}/);
  });

  /**
   * Quem marcou o bump veio do ritual e pode nunca ter feito login: o direito
   * ficou preso ao e-mail. Sem ligar à conta, o link abriria uma estante
   * vazia.
   */
  test('a conta é criada e os direitos são ligados a ela', () => {
    const fn = ENTREGA.slice(ENTREGA.indexOf('async function avisarQueChegou'));
    assert.match(fn, /garantirConta\(email\)/);
    assert.match(fn, /ligarDesbloqueiosAConta\(email, conta\.id\)/);
  });
});

describe('o destino do link mágico', () => {
  /**
   * `destino` vem da URL, e URL é do mundo. Aceitar qualquer valor faria
   * `?destino=https://outro-site` virar redirecionamento aberto assinado pelo
   * nosso domínio — e ainda logando a vítima antes de mandá-la embora.
   */
  /**
   * A lista é fixa e curta de propósito: `destino` vem da URL, e aceitar
   * qualquer valor faria `?destino=https://outro-site` virar um
   * redirecionamento aberto assinado pelo nosso domínio — logando a vítima
   * antes de mandá-la embora. Validar "começa com barra" deixaria passar
   * `//evil`, que o navegador lê como outro host.
   *
   * O que este teste protege não é o tamanho da lista, é ela existir e ser
   * consultada. Cada entrada nova precisa ser um caminho nosso, escrito aqui
   * à mão.
   */
  test('só caminho da lista fixa é aceito', () => {
    const lista = VERIFICAR.match(/DESTINOS_PERMITIDOS = new Set\(\[([^\]]*)\]\)/);
    assert.ok(lista, 'a lista fixa precisa existir');
    const caminhos = lista[1].match(/'[^']+'/g) ?? [];
    assert.ok(caminhos.length > 0, 'lista vazia não serve para nada');
    for (const caminho of caminhos) {
      assert.match(
        caminho,
        /^'\/conta\/[a-z-]+'$/,
        `${caminho} não é um caminho interno da conta`
      );
    }
    assert.match(VERIFICAR, /DESTINOS_PERMITIDOS\.has\(pedido\)/);
  });

  /**
   * Validar "começa com barra" seria quase certo e deixaria passar `//evil`,
   * que o navegador lê como outro host. A lista fixa não tem essa borda.
   */
  test('não valida por prefixo', () => {
    const trecho = VERIFICAR.slice(
      VERIFICAR.indexOf('DESTINOS_PERMITIDOS'),
      VERIFICAR.indexOf('const resposta')
    );
    assert.doesNotMatch(trecho, /startsWith\('\/'\)/);
  });

  test('o painel não aceita destino do link', () => {
    assert.match(VERIFICAR, /tipo === 'conta' && pedido && DESTINOS_PERMITIDOS/);
  });
});
