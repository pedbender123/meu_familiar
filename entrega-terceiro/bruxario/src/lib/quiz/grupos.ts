import { ITENS, type Item } from './itens';
import { ANGULO_DO_FAMILIAR } from './circulo';
import type { FamiliarId } from '../familiares';

/**
 * O mini-ritual: três cenas que apontam um GRUPO, não um familiar.
 *
 * ── Por que três, e por que estas três ────────────────────────────────────
 *
 * O funil antigo pedia 26 cenas antes de qualquer coisa. Na campanha de
 * 07/08, de 216 pessoas que chegaram, 28 começaram e 7 terminaram — e uma
 * clicou num plano. Ninguém compra o que não viu, e quase ninguém chega a
 * ver depois de treze minutos de formulário.
 *
 * Estas três não foram escolhidas a dedo: saíram de uma conta sobre o banco
 * de itens inteiro, pelo alcance de cada cena no plano agência × comunhão
 * (que é o que decide o ângulo, e portanto o grupo). São as de maior
 * separação cobrindo direções diferentes — uma puxa agência, uma comunhão, e
 * a terceira corta na diagonal.
 *
 * ── O que elas NÃO fazem ──────────────────────────────────────────────────
 *
 * Não escolhem o familiar. Três cenas para doze saídas seria chute com cara
 * de resultado. Elas estreitam para três candidatos, e é isso que a tela
 * revela de graça: o grupo. Qual dos três é o seu sai das 26 cenas, depois
 * — e é isso que está sendo vendido.
 */
export const IDS_DO_MINI = ['q06', 'q15', 'q12'] as const;

export const ITENS_DO_MINI: Item[] = IDS_DO_MINI.map(
  (id) => ITENS.find((i) => i.id === id)!
);

/** As 23 restantes, na ordem original — o ritual longo, pós-pagamento. */
export const ITENS_RESTANTES: Item[] = ITENS.filter(
  (i) => !IDS_DO_MINI.includes(i.id as (typeof IDS_DO_MINI)[number])
);

export type GrupoId = 'caminho' | 'abrigo' | 'vigilia' | 'guarda';

export interface Grupo {
  id: GrupoId;
  /** O que a tela mostra como resultado imediato. */
  nome: string;
  /** Uma linha que a pessoa lê e reconhece em si. */
  retrato: string;
  /** Três familiares — um deles é o dela. */
  familiares: FamiliarId[];
  /** Arco no circumplexo. `de` pode ser maior que `ate` (cruza o zero). */
  de: number;
  ate: number;
}

/**
 * Quatro arcos de 90°, três familiares em cada.
 *
 * O corte é a própria geometria do circumplexo (`circulo.ts`), onde os doze
 * estão de 30 em 30 graus — então cada quadrante contém exatamente três
 * vizinhos, que é o que faz o grupo ser uma família coerente e não uma
 * gaveta arbitrária.
 */
export const GRUPOS: Record<GrupoId, Grupo> = {
  caminho: {
    id: 'caminho',
    nome: 'Os que abrem caminho',
    retrato:
      'Você decide antes de ter certeza. Onde os outros esperam alguém tomar a frente, você já tomou — e depois lida com o que vier.',
    familiares: ['raposa', 'lebre', 'lobo'],
    de: 345,
    ate: 75,
  },
  abrigo: {
    id: 'abrigo',
    nome: 'Os que dão abrigo',
    retrato:
      'Você sente a temperatura de um ambiente antes das palavras. Cuidar vem antes de perceber que está cuidando, e isso cansa mais do que você admite.',
    familiares: ['cervo', 'mariposa', 'sapo'],
    de: 75,
    ate: 165,
  },
  vigilia: {
    id: 'vigilia',
    nome: 'Os que ficam de vigília',
    retrato:
      'Você olha antes de entrar. Entende a sala inteira enquanto os outros ainda estão falando — e quase nunca conta o que viu.',
    familiares: ['morcego', 'coruja', 'aranha'],
    de: 165,
    ate: 255,
  },
  guarda: {
    id: 'guarda',
    nome: 'Os que guardam',
    retrato:
      'Você escolhe pouca gente, e escolhe com cuidado. O que é seu você protege antes de dividir — não é frieza, é seleção.',
    familiares: ['gata-preta', 'serpente', 'corvo'],
    de: 255,
    ate: 345,
  },
};

export function ehGrupo(v: unknown): v is GrupoId {
  return typeof v === 'string' && v in GRUPOS;
}

function grupoDoAngulo(angulo: number): GrupoId {
  for (const g of Object.values(GRUPOS)) {
    const dentro =
      g.de < g.ate
        ? angulo >= g.de && angulo < g.ate
        : angulo >= g.de || angulo < g.ate; // arco que cruza o zero
    if (dentro) return g.id;
  }
  return 'caminho';
}

export interface ResultadoDoMini {
  grupo: Grupo;
  /** Ângulo bruto, guardado para o ritual longo continuar de onde parou. */
  angulo: number;
  /** Soma crua dos dois eixos que decidem o ângulo. */
  agencia: number;
  comunhao: number;
}

/**
 * Onde as três respostas colocam a pessoa.
 *
 * Soma crua, sem normalizar: com três itens não há amostra que justifique
 * z-score, e o que importa aqui é só a DIREÇÃO — o quadrante. A normalização
 * de verdade acontece no fim do ritual longo, em `pontuar`.
 */
export function resultadoDoMini(respostas: Record<string, number>): ResultadoDoMini {
  let agencia = 0;
  let comunhao = 0;

  for (const item of ITENS_DO_MINI) {
    const escolha = respostas[item.id];
    const opcao = typeof escolha === 'number' ? item.opcoes[escolha] : undefined;
    if (!opcao) continue;
    agencia += opcao.cargas.agencia ?? 0;
    comunhao += opcao.cargas.comunhao ?? 0;
  }

  // Empate absoluto (todas as cargas se anularam): sem direção, cai no grupo
  // mais provável em vez de num erro. Acontece em menos de 2% dos caminhos.
  const angulo =
    agencia === 0 && comunhao === 0
      ? 0
      : ((Math.atan2(comunhao, agencia) * 180) / Math.PI + 360) % 360;

  return { grupo: GRUPOS[grupoDoAngulo(angulo)], angulo, agencia, comunhao };
}

/** O familiar mais provável dentro do grupo — o "provisório" até as 26. */
export function familiarProvavel(r: ResultadoDoMini): FamiliarId {
  return r.grupo.familiares.reduce((melhor, id) => {
    const d = (a: FamiliarId) => {
      const bruta = Math.abs(((ANGULO_DO_FAMILIAR[a] - r.angulo) % 360) + 360) % 360;
      return bruta > 180 ? 360 - bruta : bruta;
    };
    return d(id) < d(melhor) ? id : melhor;
  }, r.grupo.familiares[0]);
}
