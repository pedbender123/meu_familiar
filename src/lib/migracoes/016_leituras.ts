import type { Migracao } from './tipos';

/**
 * O arquivo das leituras — a memória do Oráculo.
 *
 * ── Por que guardar tudo, e não só o texto ────────────────────────────────
 *
 * Guardar `semente` e `espetaculos_json` é o que torna a leitura
 * **reproduzível**: reabrir mostra as mesmas cartas, na mesma ordem. Sem
 * isso, o registro seria uma foto do texto e a pessoa que voltasse veria um
 * ritual diferente do que viveu.
 *
 * E é o arquivo que faz a mensagem barata parecer que lembra: ela consulta
 * daqui, com teto, em vez de receber contexto gordo toda vez.
 *
 * `custo_centavos` e `modelo` por linha desde a primeira: margem por plano é
 * métrica de produto aqui, não curiosidade de fim de mês — e sem gravar na
 * hora não dá pra reconstruir depois.
 */
const migracao: Migracao = {
  id: '016_leituras',
  descricao: 'Arquivo das leituras e mensagens do Oráculo',
  up: (db) => {
    db.exec(`
      CREATE TABLE leituras (
        id TEXT PRIMARY KEY,
        conta_id TEXT NOT NULL,
        -- 'leitura' | 'mensagem'
        tipo TEXT NOT NULL,
        pergunta TEXT NOT NULL,
        -- A semente que reproduz o sorteio inteiro.
        semente TEXT NOT NULL,
        espetaculos_json TEXT,
        resposta_json TEXT NOT NULL,
        dia_de_ouro INTEGER NOT NULL DEFAULT 0,
        modelo TEXT,
        custo_centavos INTEGER,
        tokens_entrada INTEGER,
        tokens_saida INTEGER,
        criado_em TEXT NOT NULL
      )
    `);
    db.exec(`CREATE INDEX idx_leituras_conta ON leituras (conta_id, criado_em DESC)`);
    db.exec(`CREATE INDEX idx_leituras_tipo ON leituras (conta_id, tipo, criado_em DESC)`);
  },
};

export default migracao;
