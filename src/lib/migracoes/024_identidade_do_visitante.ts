import type { Migracao } from './tipos';

/**
 * A identidade do visitante — o tracker próprio.
 *
 * ── Por que ela existe ────────────────────────────────────────────────────
 *
 * Até aqui a medição de venda dependia do navegador: `/obrigado` e
 * `MarcaCompra` disparavam `Purchase` cada um por conta própria, sem
 * `event_id`, travados por um `localStorage` que é **por navegador**. Quem
 * pagava no app do Instagram, abria o e-mail no Chrome e depois olhava no
 * computador gerava TRÊS vendas para uma. Foi exatamente o que aconteceu.
 *
 * A correção não é acertar a trava: é tirar o navegador do caminho. Quem sabe
 * que houve uma venda é o servidor, no instante em que o webhook confirma o
 * pagamento — e ele sabe uma vez só.
 *
 * ── O que esta tabela guarda, e por que no servidor ───────────────────────
 *
 * Para a Meta atribuir a venda ao anúncio certo, o evento precisa levar os
 * identificadores do navegador: `_fbp` (quem é este navegador) e `_fbc` (de
 * qual clique de anúncio ele veio). Os dois são cookies **de primeira parte**
 * no nosso domínio — então chegam ao servidor em toda requisição, no header
 * `Cookie`. Não é preciso disparar nada do navegador para lê-los; é preciso
 * apenas anotá-los enquanto a pessoa está aqui.
 *
 * `fbclid` entra separado porque ele vem na URL do clique e existe ANTES de
 * o pixel criar o `_fbc` — em navegador com bloqueador, é a única pista que
 * sobra.
 *
 * ── Virar lead é o casamento ──────────────────────────────────────────────
 *
 * O visitante nasce anônimo (`bx_v`). Quando o e-mail aparece, ele é gravado
 * aqui — e daí em diante todo o passado daquele visitante tem dono. É esse
 * casamento que permite mandar `Purchase` do servidor, horas depois, com o
 * `_fbp` de quem clicou no anúncio na semana passada.
 */
const migracao: Migracao = {
  id: '024_identidade_do_visitante',
  descricao: 'Identidade do visitante: _fbp, _fbc, fbclid, entrada e e-mail',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS identidades (
        visitante   TEXT PRIMARY KEY,
        email       TEXT,
        fbp         TEXT,
        fbc         TEXT,
        fbclid      TEXT,
        -- A URL COMPLETA da primeira chegada, com query inteira. É o que
        -- responde "de qual link exatamente veio", que nenhuma coluna
        -- normalizada consegue responder depois.
        url_entrada TEXT,
        referer     TEXT,
        user_agent  TEXT,
        ip          TEXT,
        primeiro_em TEXT NOT NULL,
        ultimo_em   TEXT NOT NULL,
        virou_lead_em TEXT
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_identidades_email ON identidades (email)`);
  },
};

export default migracao;
