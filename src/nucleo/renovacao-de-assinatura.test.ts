import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import db from '../lib/db';
import { cobrancaDoContrato, renovarAssinatura } from './cobrancas';

/** O identificador real, medido na primeira assinatura de verdade. */
const CONTRATO = 'cmti85x1r0wns01q006r6qguc';
const IDENTIFICADOR_DA_WIVEN = `app.wiven.com.br-SUBSCRIPTION-cmti85x190wnq01q0xbi9dbcv-${CONTRATO}`;

beforeEach(() => {
  db.exec('DELETE FROM assinaturas');
  db.exec('DELETE FROM cobrancas');
});

function semear(contrato = CONTRATO) {
  const agora = new Date().toISOString();
  db.prepare(
    `INSERT INTO cobrancas (id, conta_id, email, plano_id, valor_centavos, status,
       assinatura_externa_id, criado_em, atualizado_em)
     VALUES ('cob1','c1','a@b.c','p1',500,'pago',?,?,?)`
  ).run(contrato, agora, agora);
}

describe('reencontrar a assinatura na renovação', () => {
  /**
   * A cobrança do segundo mês chega com transação nova e com o identificador
   * DELES. Os dois caminhos antigos do webhook erram, e o pagamento cairia em
   * `sem_pedido`: dinheiro cobrado, acesso vencendo no dia seguinte, e nada
   * no sistema explicando por quê.
   */
  test('acha pelo contrato dentro do identificador da Wiven', () => {
    semear();
    const achada = cobrancaDoContrato(IDENTIFICADOR_DA_WIVEN);
    assert.equal(achada?.id, 'cob1');
  });

  test('não acha o que não é dela', () => {
    semear();
    assert.equal(cobrancaDoContrato('app.wiven.com.br-SUBSCRIPTION-x-outroid'), undefined);
    assert.equal(cobrancaDoContrato(null), undefined);
    assert.equal(cobrancaDoContrato(''), undefined);
  });

  /** String curta demais casaria com qualquer coisa no LIKE. */
  test('identificador curto não vira busca', () => {
    semear();
    assert.equal(cobrancaDoContrato('abc'), undefined);
  });
});

describe('estender o acesso', () => {
  function assinar(fim: string, status = 'ativa') {
    const agora = new Date().toISOString();
    db.prepare(
      `INSERT INTO assinaturas (id, conta_id, plano_id, status, inicio, fim,
         renovacao_automatica, assinatura_externa_id, criado_em, atualizado_em)
       VALUES ('a1','c1','p1',?,?,?,1,?,?,?)`
    ).run(status, agora, fim, CONTRATO, agora, agora);
  }

  /**
   * Conta a partir do `fim`, não de hoje: quem paga a renovação com dois dias
   * de antecedência não pode perder esses dois dias.
   */
  test('quem renova adiantado não perde o que sobrava', () => {
    const agora = new Date('2026-09-01T00:00:00.000Z');
    assinar('2026-09-03T00:00:00.000Z');

    const r = renovarAssinatura(CONTRATO, 30, 'trans-1', agora);
    assert.ok(r);
    assert.equal(r.fim, '2026-10-03T00:00:00.000Z', 'somou 30 dias sobre o fim, não sobre hoje');
  });

  /**
   * E quem paga atrasado começa o ciclo agora — contar de um `fim` vencido
   * daria menos tempo do que a pessoa acabou de pagar.
   */
  test('quem renova atrasado ganha o período inteiro', () => {
    const agora = new Date('2026-09-10T00:00:00.000Z');
    assinar('2026-09-01T00:00:00.000Z', 'expirada');

    const r = renovarAssinatura(CONTRATO, 30, 'trans-2', agora);
    assert.equal(r?.fim, '2026-10-10T00:00:00.000Z');
    const linha = db.prepare("SELECT status FROM assinaturas WHERE id='a1'").get() as { status: string };
    assert.equal(linha.status, 'ativa', 'renovar destranca quem tinha expirado');
  });

  /**
   * ── O bug de produção: 120 dias por um pagamento ────────────────────────
   *
   * A Wiven reenvia o webhook até receber 200. A primeira assinatura real
   * nasceu com quatro meses de acesso porque cada entrega da MESMA
   * notificação esticava o período mais trinta dias.
   *
   * Reenvio e renovação são idênticos pelo status — os dois são "aprovado,
   * deste contrato". O que os separa é o id da transação.
   */
  test('o mesmo pagamento não estica o acesso duas vezes', () => {
    const agora = new Date('2026-09-01T00:00:00.000Z');
    assinar('2026-09-01T00:00:00.000Z');

    const primeira = renovarAssinatura(CONTRATO, 30, 'trans-abc', agora);
    assert.equal(primeira?.fim, '2026-10-01T00:00:00.000Z');

    for (let i = 0; i < 3; i++) {
      assert.equal(
        renovarAssinatura(CONTRATO, 30, 'trans-abc', agora),
        null,
        'reenvio da mesma transação não pode renovar'
      );
    }

    const linha = db.prepare("SELECT fim FROM assinaturas WHERE id='a1'").get() as { fim: string };
    assert.equal(linha.fim, '2026-10-01T00:00:00.000Z', 'o acesso andou mais de um período');
  });

  /** E o mês seguinte, que traz transação nova, renova normalmente. */
  test('transação nova renova de verdade', () => {
    const agora = new Date('2026-09-01T00:00:00.000Z');
    assinar('2026-09-01T00:00:00.000Z');

    renovarAssinatura(CONTRATO, 30, 'trans-mes-1', agora);
    const segunda = renovarAssinatura(CONTRATO, 30, 'trans-mes-2', agora);
    assert.equal(segunda?.fim, '2026-10-31T00:00:00.000Z');
  });

  /** Sem transação não há como distinguir reenvio de renovação: não renova. */
  test('sem id de transação, não renova', () => {
    assinar('2026-09-01T00:00:00.000Z');
    assert.equal(renovarAssinatura(CONTRATO, 30, ''), null);
  });

  test('contrato desconhecido não renova nada', () => {
    assinar('2026-09-03T00:00:00.000Z');
    assert.equal(renovarAssinatura('contrato-que-nao-existe', 30, 'trans-x'), null);
  });
});

describe('o webhook trata renovação antes de confirmar', () => {
  const fonte = readFileSync('src/lib/webhook-pagamento.ts', 'utf8');

  /**
   * `confirmarPagamento` é idempotente de propósito — é o que impede um
   * webhook reenviado de dar dois meses a quem pagou um. Passar a renovação
   * por lá faria ela NÃO FAZER NADA, e o acesso venceria com o cliente em dia.
   */
  test('cobrança já paga com contrato vira renovação, não reconfirmação', () => {
    const i = fonte.indexOf("cobranca?.status === 'pago' && cobranca.assinatura_externa_id");
    const j = fonte.indexOf('const confirmada = confirmarPagamento');
    assert.ok(i > 0, 'o ramo de renovação precisa existir');
    assert.ok(i < j, 'a renovação tem que ser decidida antes da confirmação');
  });

  /**
   * A assinatura nova é ligada ao contrato E carimbada com a transação que a
   * pagou. O carimbo é o que faz o PRIMEIRO reenvio ser reconhecido como
   * reenvio — sem ele, a segunda entrega da mesma notificação não teria com o
   * que comparar e daria um mês de graça.
   */
  test('a assinatura nova guarda o contrato e a transação', () => {
    const bloco = fonte.slice(fonte.indexOf('ligarAssinaturaAoContrato('));
    assert.match(bloco, /confirmada\.assinatura\.id/);
    assert.match(bloco, /cobranca\.assinatura_externa_id/);
    assert.match(bloco, /resultado\.idExterno/);
  });

  /** E a renovação recebe a transação, que é o que a torna idempotente. */
  test('a renovação é chamada com o id da transação', () => {
    assert.match(fonte, /renovarAssinatura\(\s*cobranca\.assinatura_externa_id,\s*plano\.duracao_dias,\s*resultado\.idExterno/);
  });
});
