import type { Migracao } from './tipos';

/**
 * Qual campanha trouxe CADA visita, e não só a que ficou no pedido.
 *
 * ── A pergunta que não tinha resposta ─────────────────────────────────────
 *
 * Em 24/08 o dono viu tráfego de uma campanha aparecendo na outra e pediu
 * para corrigir os pedidos antigos. Não deu: o código da campanha (`?c=ig01`)
 * era consumido, virava cookie, e só a campanha JÁ RESOLVIDA chegava ao
 * pedido. `visitas.caminho` é gravado sem query string — zero visitas com
 * `?c=` no banco inteiro — e `referencia` guarda o domínio de origem.
 *
 * Ou seja: não existia registro de qual link cada pessoa clicou. Reatribuir
 * teria sido adivinhação, e reescrever histórico no chute é pior que
 * histórico errado, porque parece certo.
 *
 * ── O que estas colunas destravam ─────────────────────────────────────────
 *
 * O pedido guarda UM crédito, o da regra de atribuição. Estas colunas guardam
 * a SEQUÊNCIA de toques: quem clicou na campanha A na terça e na B na
 * quinta deixa duas linhas, e a pergunta "de qual link essa venda veio mesmo?"
 * passa a ter resposta em vez de opinião.
 *
 * Isso importa mais agora que a campanha escolhe o gateway — o crédito
 * decide em qual conta o dinheiro cai, e uma decisão dessas precisa de
 * auditoria, não só de resultado.
 *
 * `NULL` em toda visita antiga, e em toda visita que não veio de campanha.
 */
const migracao: Migracao = {
  id: '030_campanha_na_visita',
  descricao: 'Qual campanha e peça trouxeram cada visita',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(visitas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('campanha_id')) {
      db.exec(`ALTER TABLE visitas ADD COLUMN campanha_id TEXT`);
    }
    if (!colunas.includes('peca_id')) {
      db.exec(`ALTER TABLE visitas ADD COLUMN peca_id TEXT`);
    }
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_visitas_campanha ON visitas (campanha_id, criado_em)`
    );
  },
};

export default migracao;
