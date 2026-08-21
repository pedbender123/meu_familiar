/**
 * Os quatro eixos do teste (SPEC 2.2 e 2.3).
 *
 * Dois deles **decidem** o familiar; dois só **colorem** a leitura. Essa
 * separação é dura e não deve ser afrouxada: o dia em que abertura entrar na
 * escolha do bicho, a base teórica do circumplexo deixa de valer.
 */
export const EIXOS_PRINCIPAIS = ['agencia', 'comunhao'] as const;
export const EIXOS_SECUNDARIOS = ['abertura', 'estabilidade'] as const;

export type EixoPrincipal = (typeof EIXOS_PRINCIPAIS)[number];
export type EixoSecundario = (typeof EIXOS_SECUNDARIOS)[number];
export type Eixo = EixoPrincipal | EixoSecundario;

export const EIXOS: Eixo[] = [...EIXOS_PRINCIPAIS, ...EIXOS_SECUNDARIOS];

/**
 * Carga de uma opção nos eixos. Todos os campos são opcionais: a maioria das
 * opções mexe em um ou dois eixos, e zero é o padrão sensato.
 *
 * Convenção de escala: cada carga vive em [-1, +1]. Não é obrigatório por
 * código, mas é verificado nos testes — carga fora da faixa desequilibra o
 * item em relação aos outros sem ninguém perceber.
 */
export type Cargas = Partial<Record<Eixo, number>>;

export type Escores = Record<Eixo, number>;

export function escoresZerados(): Escores {
  return { agencia: 0, comunhao: 0, abertura: 0, estabilidade: 0 };
}

/** Descrição legível dos eixos, para a página pública de método (SPEC 7.5-C). */
export const DESCRICAO_DOS_EIXOS: Record<Eixo, { nome: string; explicacao: string }> = {
  agencia: {
    nome: 'Agência',
    explicacao:
      'Assertividade, iniciativa, disposição de ocupar espaço e decidir. ' +
      'Conversa com a faceta de assertividade da Extroversão nos Cinco Grandes Fatores.',
  },
  comunhao: {
    nome: 'Comunhão',
    explicacao:
      'Calor, afiliação, orientação ao outro, confiança. ' +
      'Conversa com a Amabilidade nos Cinco Grandes Fatores.',
  },
  abertura: {
    nome: 'Abertura',
    explicacao:
      'Imaginação, gosto pelo ambíguo e pelo não resolvido. Não decide o seu ' +
      'familiar — dá textura à prosa da leitura.',
  },
  estabilidade: {
    nome: 'Estabilidade emocional',
    explicacao:
      'O quanto o chão balança quando algo dá errado. Não decide o seu ' +
      'familiar — calibra o tom com que ele fala com você.',
  },
};
