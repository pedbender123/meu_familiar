import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import db from '../../lib/db';
import {
  EBOOKS,
  bumpsValidos,
  somaDosBumps,
  ebooksAVenda,
  caminhoDoTexto,
  PASTA_DA_BIBLIOTECA,
} from './catalogo';
import { desbloquear, desbloqueiosDe, estanteDe, podeAbrir } from './desbloqueios';
import { entregarBumpsDoPedido } from './entrega';
import { precoComDesconto } from '../../lib/cupons';

/**
 * Os ebooks: catálogo, preço e entrega.
 *
 * ── O PDF de mentira ──────────────────────────────────────────────────────
 *
 * Quase tudo aqui depende de o arquivo existir em disco — é assim que o
 * catálogo decide o que pode ser vendido. Os testes criam PDFs vazios e os
 * apagam no fim, porque a alternativa seria só conseguir testar depois que os
 * livros de verdade chegassem.
 */

const EMAIL = 'quem@comprou.com';

function criarArquivosFalsos() {
  fs.mkdirSync(PASTA_DA_BIBLIOTECA, { recursive: true });
    for (const e of EBOOKS) fs.writeFileSync(caminhoDoTexto(e), '## Capítulo\n\nTexto de teste.');
}

function apagarArquivosFalsos() {
  for (const e of EBOOKS) {
    try {
      fs.unlinkSync(caminhoDoTexto(e));
    } catch {
      /* já não existe */
    }
  }
}

beforeEach(() => {
  db.exec('DELETE FROM desbloqueios');
  db.exec('DELETE FROM pedidos');
  criarArquivosFalsos();
});

afterEach(apagarArquivosFalsos);

describe('a pasta de largar arquivo', () => {
  /**
   * O `LEIA-ME.md` diz os nomes exatos que o catálogo procura. Renomear um
   * arquivo no catálogo e esquecer o documento faria alguém largar o PDF com
   * o nome antigo — e o sintoma seria o livro simplesmente não aparecer, sem
   * erro nenhum para explicar por quê.
   */
  test('o LEIA-ME lista exatamente os nomes que o catálogo procura', () => {
    const leiaMe = fs.readFileSync('biblioteca/LEIA-ME.md', 'utf8');
    for (const e of EBOOKS) {
      assert.ok(
        leiaMe.includes(`biblioteca/texto/${e.arquivo}`),
        `o LEIA-ME não menciona ${e.arquivo}`
      );
      assert.ok(
        leiaMe.includes(`biblioteca/capas/${e.capa}`),
        `o LEIA-ME não menciona a capa ${e.capa}`
      );
    }
  });

  test('os arquivos são procurados na raiz, onde se larga', () => {
    assert.ok(
      caminhoDoTexto(EBOOKS[0]).includes(path.join('biblioteca', 'texto')),
      'o livro mora em biblioteca/texto'
    );
  });
});

describe('o catálogo só vende o que consegue entregar', () => {
  /**
   * O pior desfecho possível deste fluxo: a pessoa paga a mais por um livro,
   * o pagamento confirma, e a entrega devolve 404. Ela pagou por um arquivo
   * que não existe.
   */
  test('livro sem texto em disco não é oferecido nem cobrado', () => {
    apagarArquivosFalsos();
    assert.equal(ebooksAVenda().length, 0, 'sem arquivo, sem oferta');
    assert.equal(somaDosBumps(['magia-elemental']), 0, 'e sem cobrança');
    assert.deepEqual(bumpsValidos(['magia-elemental']), []);
  });

  test('com os arquivos, os três aparecem na ordem de preço', () => {
    const aVenda = ebooksAVenda();
    assert.equal(aVenda.length, 3);
    assert.deepEqual(
      aVenda.map((e) => e.precoCentavos),
      [990, 1490, 1790]
    );
  });
});

describe('o que o navegador manda não vira preço', () => {
  test('id inventado é descartado', () => {
    assert.deepEqual(bumpsValidos(['gratis', 'magia-elemental']), ['magia-elemental']);
    assert.equal(somaDosBumps(['gratis']), 0);
  });

  test('id repetido conta uma vez', () => {
    assert.deepEqual(bumpsValidos(['magia-elemental', 'magia-elemental']), [
      'magia-elemental',
    ]);
    assert.equal(somaDosBumps(['magia-elemental', 'magia-elemental']), 990);
  });

  test('lixo no lugar da lista não derruba nada', () => {
    assert.deepEqual(bumpsValidos(null), []);
    assert.deepEqual(bumpsValidos('magia-elemental'), []);
    assert.deepEqual(bumpsValidos([1, 2, {}]), []);
  });

  test('soma os três', () => {
    assert.equal(
      somaDosBumps(['magia-elemental', 'ler-o-futuro', 'terceiro-olho']),
      990 + 1490 + 1790
    );
  });
});

describe('o preço com bump', () => {
  /**
   * O cupom foi dado para a oferta que a campanha anuncia. Deixá-lo incidir
   * sobre o livro daria um desconto que ninguém prometeu, num item cujo preço
   * é a coisa toda.
   */
  test('o desconto não alcança o bump', () => {
    const p = precoComDesconto({ precoCentavos: 1890 }, 20, 990);
    assert.equal(p.finalCentavos, Math.ceil(1890 * 0.8) + 990);
    assert.equal(p.bumpsCentavos, 990);
  });

  test('o riscado continua sendo só o produto', () => {
    const p = precoComDesconto({ precoCentavos: 1890 }, 0, 990);
    assert.equal(p.cheioCentavos, 1890, 'riscar o bump afirmaria que ele já custou mais');
    assert.equal(p.finalCentavos, 1890 + 990);
  });

  /**
   * Cupom de 100% com um livro marcado não é venda grátis: são R$ 9,90 a
   * cobrar. Se o piso olhasse só o produto, o checkout seria pulado e o livro
   * entregue sem cobrança nenhuma.
   */
  test('cupom de 100% com bump ainda cobra o bump', () => {
    const p = precoComDesconto({ precoCentavos: 1890 }, 100, 990);
    assert.equal(p.gratis, false);
    assert.equal(p.finalCentavos, 990);
  });

  test('sem bump, nada muda', () => {
    const p = precoComDesconto({ precoCentavos: 1890 }, 0);
    assert.equal(p.finalCentavos, 1890);
    assert.equal(p.bumpsCentavos, 0);
  });
});

describe('o direito nasce no pagamento e não se duplica', () => {
  function pedidoComBumps(ids: string[]) {
    db.prepare(
      `INSERT INTO pedidos (id, nome, email, respostas_json, familiar, lua, produto,
         status, bumps_json, bumps_centavos, criado_em, atualizado_em)
       VALUES ('ped1','Ana',?, '{}','coruja','cheia','completa','pago', ?, ?,
         '2026-09-02T00:00:00.000Z','2026-09-02T00:00:00.000Z')`
    ).run(EMAIL, JSON.stringify(ids), somaDosBumps(ids));
  }

  test('entrega os livros marcados', () => {
    pedidoComBumps(['magia-elemental', 'terceiro-olho']);
    const entregues = entregarBumpsDoPedido('ped1');
    assert.deepEqual(entregues.sort(), ['magia-elemental', 'terceiro-olho']);
    assert.equal(desbloqueiosDe(EMAIL).length, 2);
  });

  /** O gateway reenvia o webhook até receber 200. */
  test('reenvio do webhook não dá o livro duas vezes', () => {
    pedidoComBumps(['magia-elemental']);
    assert.equal(entregarBumpsDoPedido('ped1').length, 1);
    assert.equal(entregarBumpsDoPedido('ped1').length, 0, 'a segunda passagem não cria nada');
    assert.equal(desbloqueiosDe(EMAIL).length, 1);
  });

  test('pedido sem bump não entrega nada', () => {
    db.prepare(
      `INSERT INTO pedidos (id, nome, email, respostas_json, familiar, lua, produto,
         status, criado_em, atualizado_em)
       VALUES ('ped2','Ana',?, '{}','coruja','cheia','completa','pago',
         '2026-09-02T00:00:00.000Z','2026-09-02T00:00:00.000Z')`
    ).run(EMAIL);
    assert.deepEqual(entregarBumpsDoPedido('ped2'), []);
  });

  test('o preço gravado é o do catálogo, não rateado', () => {
    pedidoComBumps(['ler-o-futuro']);
    entregarBumpsDoPedido('ped1');
    assert.equal(desbloqueiosDe(EMAIL)[0].preco_centavos, 1490);
  });
});

describe('a estante', () => {
  test('mostra o catálogo inteiro, com o comprado aberto', () => {
    desbloquear({ email: EMAIL, ebookId: 'magia-elemental', origem: 'bump' });
    const estante = estanteDe(EMAIL);
    assert.equal(estante.length, 3, 'o que não foi comprado continua na vitrine');
    assert.equal(estante.find((l) => l.ebook.id === 'magia-elemental')!.liberado, true);
    assert.equal(estante.find((l) => l.ebook.id === 'terceiro-olho')!.liberado, false);
  });

  /**
   * A assinatura abre enquanto dura. Gravar linha de desbloqueio para
   * assinante daria um direito permanente a quem paga por mês — e o
   * cancelamento não teria como retirá-lo.
   */
  test('assinante vê tudo aberto, sem virar dono de nada', () => {
    const estante = estanteDe(EMAIL, true);
    assert.ok(estante.every((l) => l.liberado));
    assert.ok(estante.every((l) => l.por === 'assinatura'));
    assert.equal(desbloqueiosDe(EMAIL).length, 0, 'nenhum direito permanente foi criado');
  });

  test('quem comprou continua dono depois de cancelar', () => {
    desbloquear({ email: EMAIL, ebookId: 'magia-elemental', origem: 'bump' });
    // assinatura acabou: `assinaturaAtiva` volta a ser falso
    const estante = estanteDe(EMAIL, false);
    assert.equal(estante.find((l) => l.ebook.id === 'magia-elemental')!.liberado, true);
    assert.equal(estante.find((l) => l.ebook.id === 'ler-o-futuro')!.liberado, false);
  });

  test('o e-mail não diferencia maiúscula', () => {
    desbloquear({ email: 'Quem@Comprou.COM', ebookId: 'terceiro-olho', origem: 'avulso' });
    assert.equal(podeAbrir(EMAIL, 'terceiro-olho'), true);
  });
});

describe('quem pode abrir o arquivo', () => {
  test('só quem comprou, ou assinante', () => {
    assert.equal(podeAbrir(EMAIL, 'magia-elemental'), false);
    assert.equal(podeAbrir(EMAIL, 'magia-elemental', true), true);
    desbloquear({ email: EMAIL, ebookId: 'magia-elemental', origem: 'bump' });
    assert.equal(podeAbrir(EMAIL, 'magia-elemental'), true);
  });

  /** Comprar um livro não abre os outros dois. */
  test('um livro não abre o catálogo', () => {
    desbloquear({ email: EMAIL, ebookId: 'magia-elemental', origem: 'bump' });
    assert.equal(podeAbrir(EMAIL, 'terceiro-olho'), false);
  });

  test('livro sem arquivo não abre nem para assinante', () => {
    apagarArquivosFalsos();
    assert.equal(podeAbrir(EMAIL, 'magia-elemental', true), false);
  });
});
