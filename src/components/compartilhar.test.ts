import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * O link de compartilhar manda a REVELAÇÃO, não a home.
 *
 * ── O relato que produziu este teste ──────────────────────────────────────
 *
 * "Se eu copio da barra de endereço e mando, compartilha. Agora se eu copio
 * aquele que está lá em compartilhar, esse não."
 *
 * O botão mandava `/?s=<código>` — a porta da frente — enquanto a barra de
 * endereço tinha `/revelacao/<id>`. Quem compartilhava mostrava um anúncio no
 * lugar da própria história, e percebia a diferença sozinho.
 */

const BOTAO = readFileSync('src/components/BotaoCompartilhar.tsx', 'utf8');
const PAGINA = readFileSync('src/app/revelacao/[id]/page.tsx', 'utf8');

describe('o que o botão de compartilhar copia', () => {
  test('o link aponta para a revelação, não para a home', () => {
    assert.match(
      BOTAO,
      /\$\{window\.location\.origin\}\/revelacao\/\$\{pedidoId\}\?s=\$\{codigo\}/,
      'ninguém compartilha "olha esse site" — compartilha "olha o que deu pra mim"'
    );
  });

  /**
   * Sem o `?s=`, o compartilhamento deixa de creditar quem trouxe a pessoa —
   * e o painel perde a única forma de dizer "esta venda veio pelo link da
   * Marina".
   */
  test('a marca de indicação continua no link', () => {
    const corpo = BOTAO.slice(BOTAO.indexOf('function enderecoPermanente'));
    assert.match(corpo, /\?s=/, 'a indicação viaja junto');
    assert.match(corpo, /slice\(0, 8\)/, 'são os 8 primeiros caracteres do id');
  });

  /** A home nunca mais pode ser o destino padrão do botão. */
  test('a home não volta a ser o destino', () => {
    const corpo = BOTAO.slice(
      BOTAO.indexOf('function enderecoPermanente'),
      BOTAO.indexOf('async function copiarLink')
    );
    assert.doesNotMatch(corpo, /origin\}\/\?s=/);
  });
});

describe('quem recebe o link tem para onde ir', () => {
  /**
   * A metade que faltava. Mandar a revelação resolve o que a pessoa quer
   * mostrar e cria o problema oposto: quem recebe lê a história de uma amiga
   * e não tem o que fazer. Era essa a preocupação por trás de o link ter
   * apontado para a home — certa, e resolvida no lugar errado.
   */
  test('a revelação convida quem não é a dona', () => {
    const bloco = PAGINA.slice(PAGINA.indexOf('{!ehADona && ('));
    assert.ok(bloco.length > 0, 'existe um bloco só para visitante');
    assert.match(bloco.slice(0, 1200), /Descobrir o meu familiar/);
  });

  /** A dona já tem o dela: oferecer o ritual a ela é falar com a pessoa errada. */
  test('a dona não recebe o convite', () => {
    assert.doesNotMatch(PAGINA, /\{ehADona && \([\s\S]{0,200}Descobrir o meu familiar/);
  });
});
