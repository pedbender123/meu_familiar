import { randomUUID } from 'crypto';
import db from '../../lib/db';
import type { ResultadoDoEspetaculo } from './espetaculos';

/**
 * O arquivo: onde as leituras ficam e de onde a mensagem lembra.
 */
export interface LeituraArquivada {
  id: string;
  conta_id: string;
  tipo: 'leitura' | 'mensagem';
  pergunta: string;
  semente: string;
  espetaculos_json: string | null;
  resposta_json: string;
  dia_de_ouro: number;
  modelo: string | null;
  custo_centavos: number | null;
  criado_em: string;
}

export function arquivar(dados: {
  contaId: string;
  tipo: 'leitura' | 'mensagem';
  pergunta: string;
  semente: string;
  espetaculos?: ResultadoDoEspetaculo[] | null;
  resposta: unknown;
  diaDeOuro: boolean;
  modelo: string;
  custoCentavos: number;
  tokensEntrada: number;
  tokensSaida: number;
}): string {
  const id = randomUUID();

  db.prepare(
    `INSERT INTO leituras
       (id, conta_id, tipo, pergunta, semente, espetaculos_json, resposta_json,
        dia_de_ouro, modelo, custo_centavos, tokens_entrada, tokens_saida, criado_em)
     VALUES (@id, @conta_id, @tipo, @pergunta, @semente, @espetaculos, @resposta,
        @dia_de_ouro, @modelo, @custo, @entrada, @saida, @agora)`
  ).run({
    id,
    conta_id: dados.contaId,
    tipo: dados.tipo,
    pergunta: dados.pergunta,
    semente: dados.semente,
    espetaculos: dados.espetaculos ? JSON.stringify(dados.espetaculos) : null,
    resposta: JSON.stringify(dados.resposta),
    dia_de_ouro: dados.diaDeOuro ? 1 : 0,
    modelo: dados.modelo,
    custo: dados.custoCentavos,
    entrada: dados.tokensEntrada,
    saida: dados.tokensSaida,
    agora: new Date().toISOString(),
  });

  return id;
}

export function historicoDaConta(contaId: string, limite = 20): LeituraArquivada[] {
  return db
    .prepare(
      `SELECT * FROM leituras WHERE conta_id = ? ORDER BY criado_em DESC LIMIT ?`
    )
    .all(contaId, limite) as LeituraArquivada[];
}

/**
 * O resumo que entra no prompt da mensagem.
 *
 * **Só leituras, e só as três últimas.** Mandar o texto inteiro de tudo
 * encheria o contexto e mataria a economia da mensagem barata — que é a razão
 * de ela existir. Três é o suficiente para "ele lembra de mim" sem virar
 * um dossiê a cada pergunta.
 *
 * Manda o conselho, não a leitura inteira: é a parte acionável, e é sobre ela
 * que a pessoa volta pra perguntar.
 */
export function resumoParaContexto(contaId: string, quantas = 3): string[] {
  const leituras = db
    .prepare(
      `SELECT pergunta, resposta_json, criado_em FROM leituras
       WHERE conta_id = ? AND tipo = 'leitura'
       ORDER BY criado_em DESC LIMIT ?`
    )
    .all(contaId, quantas) as {
    pergunta: string;
    resposta_json: string;
    criado_em: string;
  }[];

  return leituras.map((l) => {
    const quando = new Date(l.criado_em).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    });
    try {
      const resposta = JSON.parse(l.resposta_json) as { conselho?: string };
      return `${quando} — ela perguntou "${l.pergunta}". Você aconselhou: ${resposta.conselho ?? '(sem conselho registrado)'}`;
    } catch {
      return `${quando} — ela perguntou "${l.pergunta}".`;
    }
  });
}

export function buscarLeitura(id: string, contaId: string): LeituraArquivada | undefined {
  return db
    .prepare(`SELECT * FROM leituras WHERE id = ? AND conta_id = ?`)
    .get(id, contaId) as LeituraArquivada | undefined;
}
