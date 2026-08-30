import type { Migracao } from './tipos';

/**
 * A segunda chave da campanha: o ID que a Meta manda no link.
 *
 * ── O erro de premissa que isto conserta ──────────────────────────────────
 *
 * Até aqui, campanha e peça só existiam se alguém as cadastrasse no painel e
 * colasse o código `?c=XXYY` no anúncio. Isso é pedir que o time de marketing
 * aprenda um dialeto nosso, e o custo apareceu inteiro numa venda: 27/08,
 * R$ 18,90, criativo identificado internamente e **invisível** no painel
 * deles — o link não trazia `utm_*`, e a UTMify arquivou como venda direta.
 *
 * Quem compra mídia pensa "conectei a UTMify, logo está rastreado". Essa
 * leitura está certa: é assim que quase toda página de vendas funciona. O
 * conserto não é insistir no nosso código, é aceitar o deles.
 *
 * ── Por que uma coluna nova, e não o `codigo` ─────────────────────────────
 *
 * `campanhas.codigo` são DUAS letras, e `pecas.codigo` é o resto do mesmo
 * parâmetro: `?c=abXY` significa campanha `ab`, peça `XY`. O ID da Meta é uma
 * string numérica de 17 dígitos. Enfiá-lo em `codigo` quebraria o parser de
 * `?c=` para toda campanha antiga.
 *
 * Então a campanha passa a ter duas chaves: a nossa, curta, para link de bio
 * e indicação; e a da Meta, crua, para o tráfego pago. Nenhuma das duas
 * traduz a outra — traduzir é o que cria duas identidades para a mesma
 * campanha no painel de quem compra a mídia.
 *
 * ── `NULL` é o normal ─────────────────────────────────────────────────────
 *
 * Toda campanha existente fica `NULL` e continua funcionando exatamente como
 * funcionava. A coluna só se preenche em campanha nascida de UTM.
 *
 * O índice é ÚNICO mas parcial (`WHERE ... IS NOT NULL`): sem o `WHERE`, o
 * SQLite trataria os vários `NULL` das campanhas antigas como colisão em
 * alguns bancos, e a migração falharia no lugar mais caro possível.
 */
const migracao: Migracao = {
  id: '033_campanha_pelo_utm',
  descricao: 'Campanha e peça identificadas pelo ID que a Meta manda no link',
  up: (db) => {
    const colunasDe = (tabela: string) =>
      (db.prepare(`PRAGMA table_info(${tabela})`).all() as { name: string }[]).map((c) => c.name);

    if (!colunasDe('campanhas').includes('utm_campanha')) {
      db.exec(`ALTER TABLE campanhas ADD COLUMN utm_campanha TEXT`);
    }
    if (!colunasDe('pecas').includes('utm_conteudo')) {
      db.exec(`ALTER TABLE pecas ADD COLUMN utm_conteudo TEXT`);
    }

    /*
      Sem estes índices, duas visitas simultâneas do mesmo anúncio criariam
      duas campanhas com o mesmo ID da Meta — e o funil da campanha apareceria
      partido em dois, cada metade com metade das vendas.
    */
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_campanhas_utm
        ON campanhas (utm_campanha) WHERE utm_campanha IS NOT NULL
    `);
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pecas_utm
        ON pecas (campanha_id, utm_conteudo) WHERE utm_conteudo IS NOT NULL
    `);
  },
};

export default migracao;
