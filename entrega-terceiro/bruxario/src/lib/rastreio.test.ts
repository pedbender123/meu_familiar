import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deveSubstituir,
  lerAtribuicao,
  lerCodigoDeCampanha,
  lerToque,
  origemDoReferer,
  serializarAtribuicao,
  type Atribuicao,
} from './rastreio';

/**
 * As regras de atribuição são a coisa mais fácil de quebrar sem ninguém
 * perceber: o sintoma é um número errado no painel meses depois, e não um
 * erro. Estes testes existem para que a regra fique escrita em dois lugares —
 * no código e no exemplo — e um desminta o outro quando alguém mexer.
 */

/* ── lerCodigoDeCampanha ── */
test('quebra ig01 em campanha e peça', () => {
  assert.deepEqual(lerCodigoDeCampanha('ig01'), { campanha: 'ig', peca: '01' });
});

test('aceita só a campanha, para o link da bio', () => {
  assert.deepEqual(lerCodigoDeCampanha('ig'), { campanha: 'ig', peca: null });
});

test('ignora caractere que não é letra nem número', () => {
  assert.deepEqual(lerCodigoDeCampanha('IG-01'), { campanha: 'ig', peca: '01' });
});

test('recusa código de um caractere só', () => {
  assert.deepEqual(lerCodigoDeCampanha('i'), { campanha: null, peca: null });
});

/* ── lerToque — o que trouxe a pessoa ── */
test('campanha conta como aquisição', () => {
  const t = lerToque({ c: 'ig02' });
  assert.equal(t.tipo, 'campanha');
  assert.equal(t.codigoCampanha, 'ig');
  assert.equal(t.codigoPeca, '02');
  assert.equal(t.contaAquisicao, true);
});

test('e-mail de acesso NÃO conta — é retorno de quem já é cliente', () => {
  const t = lerToque({ e: 'lg' });
  assert.equal(t.tipo, 'email');
  assert.equal(t.contaAquisicao, false);
});

test('e-mail de revelação e de resgate também não contam', () => {
  assert.equal(lerToque({ e: 'rv' }).contaAquisicao, false);
  assert.equal(lerToque({ e: 'rt' }).contaAquisicao, false);
  assert.equal(lerToque({ e: 'cf' }).contaAquisicao, false);
});

test('remarketing conta — existe para reconquistar quem foi embora', () => {
  const t = lerToque({ e: 'rm' });
  assert.equal(t.tipo, 'remarketing');
  assert.equal(t.contaAquisicao, true);
});

test('o e-mail vence a campanha no mesmo link: foi ele que trouxe agora', () => {
  assert.equal(lerToque({ e: 'rm', c: 'ig01' }).tipo, 'remarketing');
});

test('indicação de cliente vira compartilhamento', () => {
  const t = lerToque({ s: '7f3ka1b2' });
  assert.equal(t.tipo, 'compartilhamento');
  assert.equal(t.codigoIndicacao, '7f3ka1b2');
  assert.equal(t.contaAquisicao, true);
});

test('sem marcação nenhuma é `direto`, não `outro`', () => {
  // A distinção importa: `outro` misturava tráfego mal marcado com quem
  // digitou o endereço, e era assim que venda de anúncio virava "outro".
  assert.equal(lerToque({}).tipo, 'direto');
  assert.equal(lerToque({}).origem, 'direto');
});

test('reconhece rede social pelo referer quando não veio parâmetro', () => {
  const t = lerToque({ referer: 'https://l.instagram.com/x' });
  assert.equal(t.tipo, 'social');
  assert.equal(t.origem, 'instagram');
});

test('buscador é canal próprio, não `outro`', () => {
  assert.equal(origemDoReferer('https://www.google.com/search?q=x'), 'busca');
});

test('navegação interna não é origem', () => {
  assert.equal(origemDoReferer('https://bruxario.com.br/ritual'), null);
});

/* ── deveSubstituir — quem leva o crédito ── */
const campanha: Atribuicao = {
  tipo: 'campanha',
  origem: 'instagram',
  campanhaId: 'c1',
  pecaId: 'p1',
  indicadoPor: null,
};

test('primeiro toque vence: voltar depois não rouba o crédito', () => {
  // Este é o bug que motivou tudo. A pessoa veio do Instagram, comprou, e
  // voltou pelo link do e-mail — o Instagram não pode perder a venda.
  assert.equal(deveSubstituir(campanha, lerToque({ e: 'lg' })), false);
  assert.equal(deveSubstituir(campanha, lerToque({})), false);
  assert.equal(deveSubstituir(campanha, lerToque({ c: 'tk01' })), false);
});

test('remarketing é a única exceção: reconquistou, levou', () => {
  assert.equal(deveSubstituir(campanha, lerToque({ e: 'rm' })), true);
});

test('sem atribuição anterior, o primeiro que conta assume', () => {
  assert.equal(deveSubstituir(null, lerToque({ c: 'ig01' })), true);
});

test('toque que não conta nunca vira atribuição, nem sem nada antes', () => {
  assert.equal(deveSubstituir(null, lerToque({ e: 'lg' })), false);
});

test('marcação de verdade substitui um `direto` anterior', () => {
  // Quem chegou sem marcação e depois voltou por um link marcado pertence à
  // marcação — o contrário é o vazamento que enchia o relatório de `outro`.
  const direto: Atribuicao = {
    tipo: 'direto',
    origem: 'direto',
    campanhaId: null,
    pecaId: null,
    indicadoPor: null,
  };
  assert.equal(deveSubstituir(direto, lerToque({ c: 'ig01' })), true);
  assert.equal(deveSubstituir(direto, lerToque({})), false);
});

/* ── cookie de atribuição ── */
test('vai e volta inteiro', () => {
  const a: Atribuicao = {
    tipo: 'campanha',
    origem: 'instagram',
    campanhaId: 'abc',
    pecaId: 'def',
    indicadoPor: null,
  };
  assert.deepEqual(lerAtribuicao(serializarAtribuicao(a)), a);
});

test('sobrevive a campo vazio', () => {
  const a: Atribuicao = {
    tipo: 'direto',
    origem: 'direto',
    campanhaId: null,
    pecaId: null,
    indicadoPor: null,
  };
  assert.deepEqual(lerAtribuicao(serializarAtribuicao(a)), a);
});

test('cookie corrompido não derruba nada', () => {
  assert.equal(lerAtribuicao(''), null);
  assert.equal(lerAtribuicao(null), null);
});

test('separador injetado no valor não quebra a leitura', () => {
  // O id vem do banco, mas o cookie é editável pelo dono do navegador —
  // um `|` a mais deslocaria todos os campos seguintes.
  const a: Atribuicao = {
    tipo: 'campanha',
    origem: 'insta|gram',
    campanhaId: 'a|b',
    pecaId: null,
    indicadoPor: null,
  };
  const lido = lerAtribuicao(serializarAtribuicao(a));
  assert.equal(lido?.origem, 'instagram');
  assert.equal(lido?.campanhaId, 'ab');
  assert.equal(lido?.pecaId, null);
});
