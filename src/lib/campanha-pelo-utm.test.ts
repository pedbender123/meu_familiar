import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import db from './db';
import {
  campanhaDoUtm,
  chaveDeUtm,
  criarCampanha,
  listarCampanhas,
  listarPecas,
  pecaDoUtm,
  TETO_DE_CAMPANHAS_AUTOMATICAS,
} from './campanhas';

function codigoDe(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

beforeEach(() => {
  db.exec('DELETE FROM pecas');
  db.exec('DELETE FROM campanhas');
});

/** O que a Meta manda de verdade: `{{campaign.id}}` vira isto. */
const ID_DA_META = '120248890724340044';
const ID_DO_ANUNCIO = '120248978282210044';

describe('a chave que vem do link', () => {
  test('o ID da Meta passa inteiro', () => {
    assert.equal(chaveDeUtm(ID_DA_META), ID_DA_META);
  });

  test('nome escrito à mão também serve', () => {
    assert.equal(chaveDeUtm('promo-agosto_2026'), 'promo-agosto_2026');
  });

  /**
   * Quando o anúncio é montado errado, a macro chega LITERAL — o link fica
   * `?utm_campaign={{campaign.id}}`. Aceitar isso criaria uma campanha
   * chamada "campaign.id" que recolheria o tráfego de todos os anúncios mal
   * montados num balde só, e ela pareceria a campanha que mais converte.
   */
  test('macro não substituída é recusada', () => {
    assert.equal(chaveDeUtm('{{campaign.id}}'), null);
    assert.equal(chaveDeUtm('{{ad.id}}'), null);
  });

  test('vazio, curto demais e lixo não viram chave', () => {
    assert.equal(chaveDeUtm(''), null);
    assert.equal(chaveDeUtm('  '), null);
    assert.equal(chaveDeUtm('x'), null);
    assert.equal(chaveDeUtm(null), null);
    assert.equal(chaveDeUtm(undefined), null);
  });

  test('string enorme é cortada, não recusada', () => {
    const chave = chaveDeUtm('a'.repeat(500));
    assert.equal(chave?.length, 64);
  });
});

describe('a campanha nasce da primeira visita', () => {
  test('cria quando não existe', () => {
    const c = campanhaDoUtm(ID_DA_META, 'instagram');
    assert.ok(c);
    assert.equal(c.utm_campanha, ID_DA_META);
    assert.equal(c.nome, ID_DA_META);
    assert.equal(c.plataforma, 'instagram');
    // O `?c=` continua livre: quem nasce do UTM não gasta código curto.
    assert.equal(c.codigo, null);
  });

  /**
   * O segundo clique do MESMO anúncio não pode criar uma campanha nova —
   * senão o funil aparece partido, cada metade com metade das vendas.
   */
  test('a segunda visita reencontra a mesma', () => {
    const primeira = campanhaDoUtm(ID_DA_META, 'instagram');
    const segunda = campanhaDoUtm(ID_DA_META, 'instagram');
    assert.equal(primeira!.id, segunda!.id);
    assert.equal(listarCampanhas().length, 1);
  });

  test('sem utm_campaign não cria nada', () => {
    assert.equal(campanhaDoUtm(null), undefined);
    assert.equal(campanhaDoUtm('{{campaign.id}}'), undefined);
    assert.equal(listarCampanhas().length, 0);
  });

  /**
   * Renomear é a razão de a chave ser o `utm_campanha` e não o nome: o
   * vínculo com o anúncio sobrevive a "120248890724340044" virar
   * "Agosto — vídeo da bruxa".
   */
  test('renomear não quebra o vínculo', () => {
    const c = campanhaDoUtm(ID_DA_META)!;
    db.prepare('UPDATE campanhas SET nome = ? WHERE id = ?').run('Agosto — bruxa', c.id);

    const dedeNovo = campanhaDoUtm(ID_DA_META);
    assert.equal(dedeNovo!.id, c.id);
    assert.equal(dedeNovo!.nome, 'Agosto — bruxa');
    assert.equal(listarCampanhas().length, 1);
  });

  /**
   * Sem teto, `/?utm_campaign=<aleatório>` num laço enche a tabela e o painel
   * de campanhas — que é uma tela de decisão — vira uma lista de lixo.
   */
  test('há um teto de criações automáticas por dia', () => {
    for (let i = 0; i < TETO_DE_CAMPANHAS_AUTOMATICAS; i++) {
      assert.ok(campanhaDoUtm(`campanha-numero-${i}`), `a ${i}ª devia ter sido criada`);
    }
    assert.equal(campanhaDoUtm('a-que-passa-do-teto'), undefined);
    assert.equal(listarCampanhas().length, TETO_DE_CAMPANHAS_AUTOMATICAS);
  });

  /** Campanha cadastrada à mão nunca é confundida com uma nascida de UTM. */
  test('campanha à mão não é reencontrada por UTM', () => {
    criarCampanha({ nome: 'Da bio', codigo: 'bi', inicio: new Date().toISOString() });
    const c = campanhaDoUtm(ID_DA_META);
    assert.ok(c);
    assert.notEqual(c.nome, 'Da bio');
    assert.equal(listarCampanhas().length, 2);
  });
});

describe('a peça nasce do criativo', () => {
  test('cria e reencontra', () => {
    const c = campanhaDoUtm(ID_DA_META)!;
    const p1 = pecaDoUtm(c.id, ID_DO_ANUNCIO);
    const p2 = pecaDoUtm(c.id, ID_DO_ANUNCIO);

    assert.ok(p1);
    assert.equal(p1.utm_conteudo, ID_DO_ANUNCIO);
    assert.equal(p1.id, p2!.id);
    assert.equal(listarPecas(c.id).length, 1);
  });

  test('dois criativos da mesma campanha são duas peças', () => {
    const c = campanhaDoUtm(ID_DA_META)!;
    pecaDoUtm(c.id, '111111111111111');
    pecaDoUtm(c.id, '222222222222222');
    assert.equal(listarPecas(c.id).length, 2);
  });

  /**
   * O `codigo` de dois dígitos continua existindo porque é ele que cabe na
   * URL curta do `?c=`. O `utm_conteudo` é a chave; o código é o apelido.
   */
  test('a peça nascida de UTM ainda ganha código curto', () => {
    const c = campanhaDoUtm(ID_DA_META)!;
    const p = pecaDoUtm(c.id, ID_DO_ANUNCIO)!;
    assert.match(p.codigo, /^\d{2}$/);
  });

  test('sem utm_content não cria peça', () => {
    const c = campanhaDoUtm(ID_DA_META)!;
    assert.equal(pecaDoUtm(c.id, null), undefined);
    assert.equal(listarPecas(c.id).length, 0);
  });
});

describe('a ordem de precedência na visita', () => {
  const fonte = codigoDe('src/app/api/visita/route.ts');

  /**
   * ── Isto já foi invertido, e voltou ────────────────────────────────────
   *
   * Em 01/09 o ID da Meta passou a vencer, porque três campanhas do
   * gerenciador estavam caindo dentro de uma campanha nossa. A medição
   * estava certa; a conclusão, não.
   *
   * **Campanha aqui não é campanha de mídia.** É recorte interno do funil, e
   * quem escolhe o recorte é quem monta o link. Deixar o gerenciador mandar
   * encheu o painel de linhas com nome de número e quebrou a leitura do
   * próprio funil. O que a UTMify recebe não passa por aqui — vai o
   * `utm_json` cru, direto de `reportarVenda`.
   */
  test('o ?c= é consultado antes do UTM', () => {
    const pos = fonte.indexOf('buscarCampanhaPorCodigo(toque.codigoCampanha)');
    const posUtm = fonte.indexOf('campanhaDoUtm(corpo.utmCampanha');
    assert.ok(pos > 0 && posUtm > 0, 'os dois caminhos precisam existir');
    assert.ok(pos < posUtm, 'o código nosso tem que ser tentado primeiro');
  });

  /** O painel não pode voltar a ser preenchido pelo gerenciador de anúncios. */
  test('o ID da Meta não decide a campanha do painel', () => {
    assert.doesNotMatch(
      fonte,
      /idDaMeta\(corpo\.utmCampanha\)\s*\?/,
      'campanha no painel é recorte interno, não espelho do gerenciador'
    );
  });

  /**
   * Tráfego pago da Meta traz `utm_source=ig`, que sozinho classificaria a
   * visita como rede social. Somar anúncio pago ao alcance orgânico do
   * Instagram é juntar dois canais de custo oposto no mesmo balde.
   */
  test('campanha resolvida faz o toque ser do tipo campanha', () => {
    assert.match(fonte, /const tipoDoToque = campanha \? 'campanha' : toque\.tipo/);
  });

  test('o cookie de atribuição guarda o mesmo tipo que a tabela', () => {
    const trecho = fonte.slice(fonte.indexOf('serializarAtribuicao'));
    assert.match(trecho, /tipo: tipoDoToque/);
  });
});

describe('o script da UTMify', () => {
  const fonte = codigoDe('src/components/ScriptUtmify.tsx');

  /**
   * O componente mora no layout raiz, que embrulha o site inteiro. Sem a
   * guarda, cada vez que o dono abre a Central para ver as vendas do dia a
   * UTMify registra uma visita sem UTM — e a conversão que a agência mede cai
   * por causa de gente que nunca foi cliente.
   */
  test('não roda no painel nem na área de quem já comprou', () => {
    assert.match(fonte, /FORA_DO_FUNIL/);
    assert.match(fonte, /'\/painel'/);
    assert.match(fonte, /'\/conta'/);
  });
});
