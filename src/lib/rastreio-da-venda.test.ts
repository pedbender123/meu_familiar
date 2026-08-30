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

  /**
   * A varredura do histórico acima era um jeito engenhoso de ADIVINHAR o ID
   * que a campanha já tinha usado. Desde a migração 033 o ID está guardado na
   * própria campanha, e adivinhar deixou de ser necessário — a busca fica
   * só como rede para as campanhas antigas, cadastradas à mão antes disso.
   */
  test('o ID guardado na campanha vem antes da adivinhação', () => {
    const guardado = fonte.indexOf('campanha.utm_campanha');
    const historico = fonte.indexOf('WHERE campanha_id = ? AND utm_json IS NOT NULL');
    assert.ok(guardado > 0, 'a campanha precisa ser consultada');
    assert.ok(guardado < historico, 'o guardado tem que ser lido primeiro');
    assert.match(fonte, /if \(!idDaCampanha\) \{/);
  });

  /**
   * A peça é o criativo: é ela que responde "qual vídeo trouxe esta venda".
   *
   * Desde que as peças passaram a nascer do `utm_content` do anúncio, o ID
   * cru da Meta vem primeiro — é ele que faz o criativo aparecer no painel
   * deles com o mesmo nome que tem no gerenciador. `codigo-nome` continua
   * atrás, para as peças cadastradas à mão, que nunca tiveram ID nenhum.
   */
  test('a peça vai como utm_content, preferindo o ID do anúncio', () => {
    assert.match(fonte, /utm_content: peca \? \(peca\.utm_conteudo \?\? `\$\{peca\.codigo\}-\$\{peca\.nome\}`\)/);
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
