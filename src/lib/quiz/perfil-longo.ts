import type { GrupoId } from './grupos';

/**
 * As escolhas do funil longo, e como elas apontam um grupo.
 *
 * ── Estas perguntas existem para VENDER, não para medir ───────────────────
 *
 * As sete cenas da isca são do outro funil e continuam lá. Aqui as perguntas
 * são as do formato validado por quem já vende neste mercado: coração,
 * objetivo, cor, elemento. Elas não são psicometria e não devem ser tratadas
 * como tal — são o que mantém a pessoa respondendo até o preço.
 *
 * O familiar de verdade continua saindo das 26 cenas, depois da compra. O
 * grupo daqui existe para a revelação ser coerente com o que a pessoa acabou
 * de responder, em vez de sorteio na cara dela.
 *
 * ── Como o grupo sai ──────────────────────────────────────────────────────
 *
 * O elemento manda, porque é a escolha mais próxima de identidade e porque os
 * doze familiares já têm elemento no catálogo. O objetivo desempata: quem
 * escolhe fogo querendo amor não é a mesma pessoa que escolhe fogo querendo
 * carreira.
 */
export const CORACAO = [
  { valor: 'relacionamento', rotulo: 'Em um relacionamento' },
  { valor: 'terminei', rotulo: 'Acabei de terminar' },
  { valor: 'casada', rotulo: 'Casada, ou quase' },
  { valor: 'buscando', rotulo: 'Buscando alguém' },
  { valor: 'sozinha', rotulo: 'Sozinha, por escolha' },
  { valor: 'complicado', rotulo: 'É complicado' },
];

export const OBJETIVOS = [
  { valor: 'amor', rotulo: 'Amor e encontros' },
  { valor: 'caminho', rotulo: 'Achar o meu caminho' },
  { valor: 'protecao', rotulo: 'Proteção e limites' },
  { valor: 'clareza', rotulo: 'Clareza sobre mim' },
];

export const MAX_OBJETIVOS = 3;

export const CORES = [
  { valor: 'vela', rotulo: 'Ouro de vela', hex: '#D9A441' },
  { valor: 'vinho', rotulo: 'Vinho antigo', hex: '#9C5A72' },
  { valor: 'musgo', rotulo: 'Musgo', hex: '#4A5D4E' },
  { valor: 'violeta', rotulo: 'Violeta-bruma', hex: '#7B6394' },
  { valor: 'ferrugem', rotulo: 'Ferrugem', hex: '#8C4A3F' },
  { valor: 'pergaminho', rotulo: 'Pergaminho', hex: '#EAE0CC' },
];

export const ELEMENTOS = [
  { valor: 'fogo', rotulo: 'Fogo', desenho: 'fogo' as const },
  { valor: 'terra', rotulo: 'Terra', desenho: 'terra' as const },
  { valor: 'ar', rotulo: 'Ar', desenho: 'ar' as const },
  { valor: 'agua', rotulo: 'Água', desenho: 'agua' as const },
];

/** Elemento → grupo, com o objetivo desempatando. */
export function grupoDoPerfilLongo(p: {
  elemento?: string;
  objetivos?: string[];
}): GrupoId {
  const primeiro = p.objetivos?.[0];

  if (primeiro === 'protecao') return 'guarda';
  if (primeiro === 'clareza') return 'vigilia';

  switch (p.elemento) {
    case 'fogo':
      return 'caminho';
    case 'agua':
      return primeiro === 'amor' ? 'abrigo' : 'vigilia';
    case 'terra':
      return primeiro === 'amor' ? 'abrigo' : 'guarda';
    case 'ar':
      return primeiro === 'amor' ? 'abrigo' : 'caminho';
    default:
      return 'caminho';
  }
}

/**
 * Quanto do perfil está preenchido, de 0 a 100.
 *
 * Os pesos são o quanto cada coisa muda a leitura de verdade: a data traz Sol
 * e Lua, a hora refina a Lua, o elemento e o objetivo escolhem o tom. Nada
 * aqui é peso inventado para a barra andar bonito.
 */
export function energiaDoPerfil(p: {
  genero?: string;
  nascimento?: boolean;
  hora?: boolean;
  cidade?: string;
  coracao?: string;
  objetivos?: string[];
  cor?: string;
  elemento?: string;
  palma?: boolean;
}): number {
  const pesos: [boolean, number][] = [
    [!!p.genero, 8],
    [!!p.nascimento, 26],
    [!!p.hora, 14],
    [!!p.cidade, 8],
    [!!p.coracao, 8],
    [!!p.objetivos?.length, 12],
    [!!p.cor, 4],
    [!!p.elemento, 10],
    [!!p.palma, 10],
  ];
  return pesos.reduce((s, [ok, peso]) => s + (ok ? peso : 0), 0);
}
