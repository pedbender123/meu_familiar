import type { Migracao } from './tipos';

/**
 * A fila do Oráculo — o que faz o plano grátis caber numa chave de API de
 * tier gratuito.
 *
 * A economia é essa: tier gratuito costuma ser apertado por minuto e folgado
 * por dia. Resposta síncrona bate no limite por minuto no primeiro pico e
 * desperdiça a folga diária inteira; uma fila drenando devagar faz o
 * contrário — usa a cota do dia toda, sem nunca estourar a do minuto.
 *
 * Ordem de chegada (`criado_em`), sem prioridade por enquanto. Quando
 * existir plano pago com `oraculoNaHora: false` (se existir), é aqui que
 * entra uma coluna de prioridade — não vale antecipar.
 *
 * `respondida_em` separado de `status` de propósito: dá pra medir quanto
 * tempo a fila realmente levou, que é o número que decide se o grátis está
 * bom demais (canibaliza o pago) ou ruim demais (ninguém volta).
 */
const migracao: Migracao = {
  id: '008_fila_oraculo',
  descricao: 'Fila de consultas do Oráculo, para o plano gratuito',
  up: (db) => {
    db.exec(`
      CREATE TABLE consultas_oraculo (
        id TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL,
        modo TEXT NOT NULL DEFAULT 'duvida',
        pergunta TEXT NOT NULL,
        resposta TEXT,
        -- pendente | respondida | falhou
        status TEXT NOT NULL DEFAULT 'pendente',
        tentativas INTEGER NOT NULL DEFAULT 0,
        ultimo_erro TEXT,
        modelo TEXT,
        custo_centavos INTEGER,
        criado_em TEXT NOT NULL,
        respondida_em TEXT
      )
    `);
    db.exec(
      `CREATE INDEX idx_consultas_pendentes ON consultas_oraculo (status, criado_em)`
    );
    db.exec(
      `CREATE INDEX idx_consultas_conta ON consultas_oraculo (conta_id, criado_em DESC)`
    );
  },
};

export default migracao;
