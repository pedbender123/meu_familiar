import type { Migracao } from './tipos';

/**
 * O conjunto de anúncios a que cada criativo pertence.
 *
 * ── O nível que faltava ───────────────────────────────────────────────────
 *
 * O gerenciador da Meta tem três degraus: campanha → conjunto → anúncio. A
 * gente guardava o primeiro (`utm_campaign`) e o terceiro (`utm_content`), e
 * o do meio (`utm_term` = `{{adset.id}}`) só existia dentro do `utm_json` de
 * um pedido pago — invisível para quem só visitou, e impossível de agrupar.
 *
 * O conjunto é onde a decisão de mídia acontece: é nele que se define público
 * e orçamento. Sem ele, a leitura pula de "a campanha foi bem" para "este
 * vídeo foi bem" e perde a pergunta do meio — **qual público** respondeu.
 *
 * ── Por que na peça, e não numa tabela nova ───────────────────────────────
 *
 * Um anúncio pertence a exatamente um conjunto, e a peça já é o anúncio. Uma
 * tabela `conjuntos` só se pagaria se conjunto tivesse atributos próprios
 * (nome, orçamento) — e não tem, porque nada disso chega até nós. Agrupar por
 * uma coluna responde a mesma pergunta sem uma junção a mais em toda consulta.
 *
 * Nulo em toda peça cadastrada à mão e em tudo que veio antes: elas não têm
 * conjunto nenhum, e inventar um seria fabricar um degrau que não existiu.
 */
const migracao: Migracao = {
  id: '036_conjunto_da_peca',
  descricao: 'Guarda o conjunto de anúncios (utm_term) de cada criativo',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pecas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('utm_conjunto')) {
      db.exec(`ALTER TABLE pecas ADD COLUMN utm_conjunto TEXT`);
    }
    /*
      A dash por conjunto varre as peças de uma campanha agrupando por aqui.
      Sem índice, cada abertura é uma varredura completa — barato hoje, caro
      no dia em que a conta tiver milhares de anúncios, que é justamente
      quando alguém vai querer olhar.
    */
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_pecas_conjunto ON pecas (campanha_id, utm_conjunto)`
    );
  },
};

export default migracao;
