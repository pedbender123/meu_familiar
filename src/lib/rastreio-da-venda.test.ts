import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('venda sem UTM na URL ainda tem campanha', () => {
  const fonte = codigoDe('src/lib/reportar-venda.ts');

  /**
   * O caso real de 27/08: venda pela Wiven, `utm_json` nulo, mas
   * `campanha_id` e `peca_id` preenchidos — o `?c=` funcionou e os `utm_*`
   * não vieram no link do anúncio.
   *
   * Sem UTM, a Utmify arquiva como venda direta. Ela ENTRA no painel, mas
   * fora de qualquer campanha, que para quem está olhando o resultado de uma
   * campanha específica é o mesmo que sumir. Foi exatamente o que aconteceu:
   * a API respondeu `{"OK":true,"result":"SUCCESS"}` e a venda não aparecia.
   */
  test('o rastreio é preenchido a partir da campanha do pedido', () => {
    assert.match(fonte, /!rastreio\.utm_campaign && pedido\.campanha_id/);
    assert.match(fonte, /rastreioDaCampanha\(pedido\)/);
  });

  /**
   * A Meta manda o ID numérico da campanha, não o nome. Mandar "Comeccou!"
   * faria a Utmify mostrar DUAS campanhas para a mesma coisa — uma com o id,
   * outra com o nome — e o resultado ficaria dividido entre as duas.
   */
  test('reaproveita o id que a campanha já usou, em vez do nome', () => {
    assert.match(fonte, /WHERE campanha_id = \? AND utm_json IS NOT NULL/);
    assert.match(fonte, /idDaCampanha \?\? campanha\.nome/);
  });

  /** A peça é o criativo: é ela que responde "qual vídeo trouxe esta venda". */
  test('a peça vai como utm_content', () => {
    assert.match(fonte, /utm_content: peca \? `\$\{peca\.codigo\}-\$\{peca\.nome\}`/);
  });

  /** O UTM que veio na URL sempre ganha: ele é o que a Meta realmente mandou. */
  test('não sobrescreve o que veio no link', () => {
    assert.match(fonte, /\{ \.\.\.rastreio, \.\.\.rastreioDaCampanha\(pedido\) \}/);
    const i = fonte.indexOf('if (!rastreio.utm_campaign');
    assert.ok(i > fonte.indexOf('JSON.parse(pedido.utm_json)'), 'o do link é lido primeiro');
  });

  /** Pedido sem campanha nenhuma continua indo como direto — é a verdade. */
  test('sem campanha, nada é inventado', () => {
    assert.match(fonte, /if \(!campanha\) return \{\};/);
  });
});
