import type { Migracao } from './tipos';

/**
 * A biblioteca: o que cada pessoa desbloqueou, e o que ela marcou no checkout.
 *
 * ── Duas coisas diferentes, e por isso duas mudanças ──────────────────────
 *
 * `pedidos.bumps_json` é a INTENÇÃO: os livros marcados na tela, gravados
 * antes de a cobrança sair. Ele existe no pedido, e não numa tabela à parte,
 * porque é parte do que foi cobrado — o valor do pedido passa a ser o produto
 * mais estes itens, e separar isso do pedido seria poder somar errado.
 *
 * `desbloqueios` é o DIREITO: o que a pessoa pode abrir. Ele só nasce quando
 * o pagamento confirma, e é o que a biblioteca consulta.
 *
 * Manter os dois separados é o que faz a pergunta "ela pagou por este livro?"
 * ter uma resposta só. Se o direito morasse no pedido, quem comprou o mesmo
 * livro por dentro do app teria o direito noutro lugar, e a tela precisaria
 * juntar duas fontes toda vez — que é como se esquece uma.
 *
 * ── Por que a chave é o E-MAIL, e não a conta ─────────────────────────────
 *
 * Quem marca o bump está no meio do funil e **pode não ter conta ainda**: a
 * conta nasce na entrega, depois do pagamento. Chavear por `conta_id` exigiria
 * criar a conta antes de saber se o pagamento vai confirmar, ou deixar o
 * direito órfão até o primeiro login.
 *
 * O e-mail é o que existe do início ao fim, é o que `entregarChaveDaPlataforma`
 * já usa para ligar pedido a conta, e é para ele que o livro é enviado.
 * `conta_id` fica junto quando dá, por conveniência de consulta.
 *
 * ── O índice único, e o que ele impede ────────────────────────────────────
 *
 * Uma pessoa, um livro, um direito. Sem ele: comprar no bump e depois de novo
 * dentro do app criaria duas linhas, a biblioteca mostraria o livro duas
 * vezes, e a soma de "quanto essa pessoa já gastou" contaria dobrado. Com
 * ele, a segunda compra falha no INSERT e o código trata como já-tem — que é
 * a verdade.
 */
const migracao: Migracao = {
  id: '041_biblioteca',
  descricao: 'Ebooks: o que foi marcado no checkout e o que cada pessoa desbloqueou',
  up: (db) => {
    const colunas = (db.prepare(`PRAGMA table_info(pedidos)`).all() as { name: string }[]).map(
      (c) => c.name
    );
    if (!colunas.includes('bumps_json')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN bumps_json TEXT`);
    }
    /*
      Quanto dos bumps entrou neste pedido, em centavos.

      Gravado junto da cobrança e não recalculado depois: o preço do livro
      pode mudar, e uma venda antiga precisa continuar valendo o que foi
      cobrado. É a mesma regra que já vale para `bruto_centavos`.
    */
    if (!colunas.includes('bumps_centavos')) {
      db.exec(`ALTER TABLE pedidos ADD COLUMN bumps_centavos INTEGER`);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS desbloqueios (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        conta_id TEXT,
        ebook_id TEXT NOT NULL,
        -- bump | avulso | assinatura | cortesia
        origem TEXT NOT NULL,
        -- De onde veio o dinheiro, quando veio de algum lugar.
        pedido_id TEXT,
        cobranca_id TEXT,
        -- Quanto foi pago POR ESTE LIVRO. Zero em cortesia.
        preco_centavos INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_desbloqueios_pessoa
        ON desbloqueios (email, ebook_id)
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_desbloqueios_conta ON desbloqueios (conta_id)`);
    /*
      O relatório pergunta "quanto os bumps renderam no período", e a resposta
      vem daqui varrendo por data.
    */
    db.exec(`CREATE INDEX IF NOT EXISTS idx_desbloqueios_data ON desbloqueios (criado_em)`);
  },
};

export default migracao;
