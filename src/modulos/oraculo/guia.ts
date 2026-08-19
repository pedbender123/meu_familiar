import { randomUUID } from 'node:crypto';
import db from '../../lib/db';
import { gerarJson } from './gerar';
import { NOME_DO_DOMINIO, type PontuacaoDoDia, type Classe } from '../calendario/pontuacao';

/**
 * O guia da semana — o que o plano do meio vende e o de cima também entrega.
 *
 * ── Por que ele não é "uma leitura mais curta" ────────────────────────────
 *
 * A leitura responde a uma pergunta que a pessoa fez. O guia responde a uma
 * que ela não fez: *"o que vem por aí?"*. Isso muda o texto inteiro — ele é
 * ancorado em DIAS, não em símbolos, e o valor está em ser específico o
 * bastante para a pessoa reconhecer o dia quando ele chegar.
 *
 * Por isso o esquema tem um campo por dia: sem ele o modelo escreve um
 * horóscopo genérico de semana e o produto vira o que qualquer site já dá de
 * graça. Com ele, dizer "quinta" é obrigatório — e a quinta vem do cálculo
 * astronômico real, não da invenção do modelo.
 *
 * ── Nenhuma parte astrológica é inventada ─────────────────────────────────
 *
 * As notas por domínio e as classes de cada dia chegam prontas do
 * `calendario`, calculadas por `astronomy-engine` contra o mapa natal dela. O
 * modelo escreve a prosa em cima de números que ele não escolheu — é o que
 * separa isto de um gerador de texto bonito.
 */

export interface DiaDoGuia {
  /** `YYYY-MM-DD`, para a tela poder casar com o calendário. */
  data: string;
  /** "segunda", "terça"... — como a pessoa fala, não como o código guarda. */
  nome: string;
  texto: string;
}

export interface GuiaSemanal {
  abertura: string;
  dias: DiaDoGuia[];
  /** O dia da semana que mais pede atenção, e por quê. */
  destaque: string;
  fechamento: string;
}

const ESQUEMA = {
  type: 'object',
  properties: {
    abertura: { type: 'string' },
    dias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string' },
          nome: { type: 'string' },
          texto: { type: 'string' },
        },
        required: ['data', 'nome', 'texto'],
      },
    },
    destaque: { type: 'string' },
    fechamento: { type: 'string' },
  },
  required: ['abertura', 'dias', 'destaque', 'fechamento'],
} as const;

export interface DiaCalculado {
  data: string;
  nome: string;
  classe: Classe | undefined;
  ouro: boolean;
  pontuacao: PontuacaoDoDia | undefined;
  destaque: { dominio: string; nota: number } | undefined;
}

/** A segunda-feira que abre a semana de uma data. É a chave de unicidade. */
export function segundaDaSemana(quando = new Date()): string {
  const d = new Date(quando.getFullYear(), quando.getMonth(), quando.getDate());
  // getDay(): 0 = domingo. A segunda anterior está a (dia + 6) % 7 dias atrás.
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function descreverDia(dia: DiaCalculado): string {
  const partes: string[] = [`${dia.nome} (${dia.data})`];

  if (dia.ouro) partes.push('DIA DE OURO — as quatro portas abertas');
  else if (dia.classe) partes.push(`tom geral: ${dia.classe}`);

  if (dia.pontuacao) {
    const notas = Object.entries(dia.pontuacao)
      .map(([dominio, nota]) => {
        const nome = NOME_DO_DOMINIO[dominio as keyof typeof NOME_DO_DOMINIO] ?? dominio;
        return `${nome} ${Math.round(nota as number)}`;
      })
      .join(', ');
    partes.push(notas);
  }

  return `- ${partes.join(' · ')}`;
}

/**
 * Monta o texto e devolve o custo junto.
 *
 * Quem chama grava — a função não escreve no banco de propósito, para poder
 * ser exercitada num teste sem deixar rastro e para o script decidir o que
 * fazer quando o envio falha depois da geração.
 */
export async function gerarGuiaSemanal(dados: {
  nomeDaPessoa: string;
  nomeDoFamiliar: string;
  perfil: string;
  dias: DiaCalculado[];
  historico?: string;
}) {
  const primeiro = dados.nomeDaPessoa.trim().split(/\s+/)[0] || 'ela';

  const prompt = `Você é ${dados.nomeDoFamiliar}, o familiar de ${primeiro}.
Escreva o guia da semana dela: curto, direto e em segunda pessoa.

QUEM ELA É
${dados.perfil}
${dados.historico ? `\nO QUE ELA JÁ CONTOU\n${dados.historico}` : ''}

OS DIAS DA SEMANA, JÁ CALCULADOS NO MAPA NATAL DELA
${dados.dias.map(descreverDia).join('\n')}

REGRAS
- Escreva um parágrafo curto (2 a 3 frases) para CADA dia listado, na ordem.
- Use as notas acima: dia com nota alta em amor fala de amor; nota baixa fala
  de recolher. Não invente aspecto astrológico nenhum — os números já vieram.
- Cite o nome do dia dentro do texto, para ela reconhecer quando chegar.
- Seja concreto: "manda a mensagem que você adiou" vale mais que "a energia
  favorece a comunicação".
- Nada de previsão de fato futuro, promessa de dinheiro, saúde ou volta de
  alguém. É leitura simbólica.
- No destaque, escolha UM dia e diga em uma frase por que é o dele.
- Tom: íntimo, seco, sem misticismo de banca de jornal. Você a conhece.`;

  return gerarJson<GuiaSemanal>('leitura', prompt, ESQUEMA);
}

/* ── guardar e ler ─────────────────────────────────────────────────────── */

export interface GuiaGuardado {
  id: string;
  conta_id: string;
  semana: string;
  corpo_json: string;
  enviado_em: string | null;
  criado_em: string;
}

export function guiaDaSemana(contaId: string, semana: string): GuiaGuardado | undefined {
  return db
    .prepare('SELECT * FROM guias_semanais WHERE conta_id = ? AND semana = ?')
    .get(contaId, semana) as GuiaGuardado | undefined;
}

export function guardarGuia(dados: {
  contaId: string;
  semana: string;
  corpo: GuiaSemanal;
  modelo: string;
  custoCentavos: number;
  tokensEntrada: number;
  tokensSaida: number;
}): string {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO guias_semanais
       (id, conta_id, semana, corpo_json, modelo, custo_centavos,
        tokens_entrada, tokens_saida, criado_em)
     VALUES (@id, @contaId, @semana, @corpo, @modelo, @custo, @entrada, @saida, @agora)`
  ).run({
    id,
    contaId: dados.contaId,
    semana: dados.semana,
    corpo: JSON.stringify(dados.corpo),
    modelo: dados.modelo,
    custo: dados.custoCentavos,
    entrada: dados.tokensEntrada,
    saida: dados.tokensSaida,
    agora: new Date().toISOString(),
  });
  return id;
}

export function marcarGuiaEnviado(id: string): void {
  db.prepare('UPDATE guias_semanais SET enviado_em = ? WHERE id = ?').run(
    new Date().toISOString(),
    id
  );
}

/** Os guias de uma conta, do mais novo para o mais velho — para a tela. */
export function guiasDaConta(contaId: string, limite = 12): GuiaGuardado[] {
  return db
    .prepare(
      'SELECT * FROM guias_semanais WHERE conta_id = ? ORDER BY semana DESC LIMIT ?'
    )
    .all(contaId, limite) as GuiaGuardado[];
}
