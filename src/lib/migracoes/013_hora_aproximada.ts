import type { Migracao } from './tipos';

/**
 * Marca quando a hora de nascimento foi chutada em vez de informada.
 *
 * ── Por que meio-dia, e por que a marca importa ───────────────────────────
 *
 * Muita gente simplesmente não sabe a hora em que nasceu, e exigir o dado
 * seria trancar essas pessoas fora do Calendário por uma informação que elas
 * não têm como obter. A convenção astrológica para esse caso é **meio-dia**:
 * é o ponto que minimiza o erro máximo da posição da Lua (que anda ~13° por
 * dia), então o pior caso fica em ±6h em vez de ±24h.
 *
 * Mas Sol e Lua são uma coisa e **ascendente é outra**: ele gira 360° em 24h,
 * ou seja, cerca de um signo a cada duas horas. Com hora chutada, o
 * ascendente é ficção — e o produto não pode afirmar com a mesma confiança
 * as duas coisas.
 *
 * Daí a coluna: sem ela, `nascimento_hora = '12:00'` seria indistinguível de
 * alguém que realmente nasceu ao meio-dia, e o Calendário prometeria casas
 * astrológicas que não tem como calcular. A marca é o que permite entregar
 * o que dá pra entregar e ser honesto sobre o resto — e pedir a hora depois,
 * se a pessoa descobrir.
 */
const migracao: Migracao = {
  id: '013_hora_aproximada',
  descricao: 'Marca hora de nascimento estimada (meio-dia) quando a pessoa não sabe',
  up: (db) => {
    const existe = db
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'contas'`)
      .get();
    if (!existe) return;

    const colunas = (db.prepare(`PRAGMA table_info(contas)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('nascimento_hora_aproximada')) {
      db.exec(
        `ALTER TABLE contas ADD COLUMN nascimento_hora_aproximada INTEGER NOT NULL DEFAULT 0`
      );
    }
  },
};

export default migracao;
