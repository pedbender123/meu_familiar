import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import db from '../lib/db';

/**
 * O "de R$ 37,90" da assinatura é vitrine, e precisa continuar sendo.
 *
 * ── O erro que este arquivo existe para impedir ───────────────────────────
 *
 * A assinatura custa R$ 29,90 e a cobrança de plano passa
 * `descontoPercentual: 0`, lendo o preço da tabela `planos` no servidor. O
 * cupom de lançamento **não alcança plano**.
 *
 * Então o dia em que alguém achar que o riscado "não está batendo" e
 * consertar inflando `planos.revelacao_mensal` para 3790, o cliente passa a
 * pagar R$ 37,90 de verdade — numa assinatura recorrente, todo mês, sem
 * ninguém perceber até a primeira reclamação.
 */
describe('o riscado da assinatura', () => {
  test('a assinatura cobra 29,90, não o riscado', () => {
    const plano = db
      .prepare("SELECT preco_centavos FROM planos WHERE id = 'revelacao_mensal'")
      .get() as { preco_centavos: number } | undefined;

    assert.ok(plano, 'o plano mensal precisa existir');
    assert.equal(
      plano.preco_centavos,
      2990,
      'inflar isto cobra o riscado de verdade — o cupom não alcança plano'
    );
  });

  /**
   * E o número de vitrine mora num arquivo só.
   *
   * Quem já é cliente e vê "de 37,90" dentro do app lembra disso na hora de
   * renovar. A oferta de vendas é para quem ainda não comprou e está
   * comparando três coisas; lá dentro é outra conversa.
   */
  test('o 3790 não vaza para nenhuma outra tela', () => {
    function arquivos(dir: string, achados: string[] = []): string[] {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) arquivos(caminho, achados);
        else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
      }
      return achados;
    }

    /*
      Uma casa só: `modelo-de-venda.ts`. A `Oferta.tsx` já teve a sua cópia, e
      duas cópias de um preço é como elas divergem — uma tela mostrando 37,90
      e outra 34,90, sem ninguém saber qual é a certa.
    */
    const culpados = arquivos('src').filter(
      (a) => a !== 'src/lib/modelo-de-venda.ts' && /\b3790\b/.test(readFileSync(a, 'utf8'))
    );

    assert.deepEqual(
      culpados,
      [],
      `o preço de vitrine escapou para: ${culpados.join(', ')}`
    );
  });

  /** A cobrança de plano não pode passar a aplicar desconto por engano. */
  test('a cobrança de plano continua sem desconto', () => {
    const fonte = readFileSync('src/app/api/cobranca/[id]/pagamento/route.ts', 'utf8');
    assert.match(fonte, /descontoPercentual: 0/);
  });
});
