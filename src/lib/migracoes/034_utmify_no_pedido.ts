import type { Migracao } from './tipos';

/**
 * Quando a UTMify aceitou esta venda — e se não aceitou.
 *
 * ── A afirmação que ninguém conseguia conferir ────────────────────────────
 *
 * A partir de agora a frase que a agência ouve é: *"a Wiven não avisa a
 * UTMify em cobrança por API — ela avisa a NÓS, e o nosso sistema repassa"*.
 * Ela é verdadeira e é a arquitetura escolhida.
 *
 * Só que ela transfere para cá a responsabilidade inteira do relatório deles.
 * E até esta migração, o resultado de cada envio existia **só no console**:
 * um `console.log` de sucesso, um `console.error` de falha, e nada em lugar
 * nenhum depois que o log rotacionasse.
 *
 * Isso já custou uma noite. A venda de 27/08 teve `SUCCESS` da API deles e
 * mesmo assim não apareceu na campanha — e a única forma de descobrir foi o
 * dono procurar à mão. Com estas duas colunas, "a UTMify está recebendo" vira
 * uma pergunta que o computador responde, na tela de Saúde, sem ninguém
 * precisar abrir log.
 *
 * ── Por que duas colunas, e não um booleano ───────────────────────────────
 *
 * `utmify_em` responde "quando deu certo pela última vez" e `utmify_erro`
 * responde "o que estava errado". Um booleano `reportado` perderia as duas: o
 * dia em que parasse, ninguém saberia desde quando nem por quê.
 *
 * Pedido antigo fica com as duas nulas. Nulo aqui é **"não se sabe"**, não
 * "falhou" — a tela de Saúde tem um estado próprio para isso, e pintar o
 * histórico de vermelho ensinaria a ignorar vermelho.
 */
const migracao: Migracao = {
  id: '034_utmify_no_pedido',
  descricao: 'Guarda se a UTMify aceitou o relato de cada venda',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('utmify_em')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN utmify_em TEXT`);
    }
    if (!colunas.includes('utmify_erro')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN utmify_erro TEXT`);
    }
  },
};

export default migracao;
