import type { Migracao } from './tipos';

/**
 * O núcleo modular, por baixo — docs/reestruturacao.md, Fase 2.
 *
 * `planos` é o catálogo (hoje um espelho de `PRODUTOS`, ver
 * `src/nucleo/planos.ts`); `assinaturas` é o que substitui, aos poucos, "o
 * pedido que a pessoa comprou" como fonte de verdade de acesso. As duas
 * tabelas nascem **sem nada as lendo ainda** — a escrita dupla e a
 * comparação em sombra entram atrás de interruptor, desligadas por padrão
 * (disciplina 3).
 */
const migracao: Migracao = {
  id: '005_nucleo_assinaturas',
  descricao: 'Tabelas planos e assinaturas — núcleo modular em sombra',
  up: (db) => {
    db.exec(`
      CREATE TABLE planos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        preco_centavos INTEGER NOT NULL,
        -- NULL = acesso pra sempre. Hoje TODO plano é assim — "o que expira
        -- não é o acesso, é o link público" (produtos.ts). Planos com prazo
        -- de verdade entram na Fase 6.
        duracao_dias INTEGER,
        recorrente INTEGER NOT NULL DEFAULT 0,
        parcelas_max INTEGER NOT NULL DEFAULT 1,
        publico INTEGER NOT NULL DEFAULT 1,
        direitos_json TEXT NOT NULL,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE assinaturas (
        id TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL,
        plano_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ativa',
        inicio TEXT NOT NULL,
        fim TEXT,
        renovacao_automatica INTEGER NOT NULL DEFAULT 0,
        -- O pedido que originou esta assinatura, quando existir — rastro
        -- pra auditoria e pra não criar duas assinaturas do mesmo pedido.
        pedido_id TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_assinaturas_conta ON assinaturas (conta_id, status)`);
    db.exec(`CREATE UNIQUE INDEX idx_assinaturas_pedido ON assinaturas (pedido_id) WHERE pedido_id IS NOT NULL`);

    // Seed: hoje só existem dois planos comprável de fato (revelacao e
    // completa — link_permanente é adicional sobre um pedido existente, não
    // um plano próprio, e fica de fora por ora). Espelha PRODUTOS
    // exatamente, pra escrita dupla não divergir do que já vende.
    const agora = new Date().toISOString();
    const inserir = db.prepare(
      `INSERT INTO planos (id, nome, preco_centavos, duracao_dias, recorrente,
         parcelas_max, publico, direitos_json, ativo, criado_em, atualizado_em)
       VALUES (@id, @nome, @preco_centavos, NULL, 0, 1, 1, @direitos_json, 1, @agora, @agora)`
    );
    inserir.run({
      id: 'revelacao',
      nome: 'Revelação',
      preco_centavos: 980,
      direitos_json: JSON.stringify({
        pdf: true,
        imagens: true,
        relatorioCompleto: false,
        graficos: false,
        perfilPublico: false,
        tiragemDiaria: false,
        perguntasOraculo: 0,
        narracaoAudio: false,
      }),
      agora,
    });
    inserir.run({
      id: 'completa',
      nome: 'Completa',
      preco_centavos: 1890,
      direitos_json: JSON.stringify({
        pdf: true,
        imagens: true,
        relatorioCompleto: true,
        graficos: true,
        perfilPublico: true,
        tiragemDiaria: true,
        perguntasOraculo: 10,
        narracaoAudio: true,
      }),
      agora,
    });
  },
};

export default migracao;
