import type { FamiliarId } from '../familiares';
import { ITENS, type Item } from './itens';
import { EIXOS, escoresZerados, type Eixo, type Escores } from './eixos';
import { afinidades, paraPolar, type Afinidade } from './circulo';

/**
 * O motor de pontuação (SPEC 2.4).
 *
 *   cargas → escore bruto → normalização → ângulo e magnitude
 *          → familiar vencedor → 12 escores de afinidade
 *
 * Lógica pura de propósito: nada aqui toca banco, rede ou relógio. É o que o
 * SPEC 0.7 pede ("testável no terminal") e o que permite os testes rodarem em
 * milissegundos.
 *
 * ── O que isto substitui ──────────────────────────────────────────────────
 *
 * O motor antigo somava +2 ao bicho a cada resposta e desempatava pelo
 * elemento do signo solar. Dois problemas, ambos nomeados pelo SPEC 2.1: com 8
 * itens para 12 saídas o empate era a regra, e o desempate frequente virava
 * **o** critério na prática — daí a sensação de que era o signo que decidia.
 * Além disso, pontuação "+1 pro X" é ipsativa: mede posição relativa dentro da
 * pessoa e não permite comparar duas pessoas.
 *
 * Aqui o signo tem **peso zero** (SPEC 2.4, travado). Ele entra na leitura
 * como textura narrativa, nunca na escolha.
 */

/** Resposta = índice da opção escolhida, por id de item. */
export type Respostas = Record<string, number>;

export interface Normalizacao {
  media: Record<Eixo, number>;
  desvio: Record<Eixo, number>;
  /** Quantos respondentes sustentam estes números. */
  base: number;
  origem: 'teorica' | 'amostra';
}

export interface Resultado {
  /** Soma crua das cargas. Guardado para auditoria e para recalcular depois. */
  bruto: Escores;
  /** Escores em z, contra a base. É o que vira ângulo. */
  normalizado: Escores;
  angulo: number;
  /**
   * Distância do centro do círculo. Perto de zero significa que o teste **não
   * distinguiu bem** este perfil — não que a pessoa seja "meio de cada".
   */
  magnitude: number;
  familiar: FamiliarId;
  /** Os 12, ordenados do mais próximo ao mais distante (SPEC 0.8: salvar todos). */
  afinidades: Afinidade[];
  /** Preenchido quando dois arquétipos ficam dentro do limiar de empate. */
  empate: { entre: [FamiliarId, FamiliarId]; diferenca: number } | null;
  normalizacao: Normalizacao;
}

/**
 * Abaixo desta diferença entre o 1º e o 2º colocado, a escolha vira ruído e a
 * 27ª pergunta entra — quem decide passa a ser a pessoa (SPEC 2.4).
 *
 * **O número tem consequência direta e calculável.** Como os arquétipos estão
 * a 30° um do outro, a diferença entre as distâncias ao 1º e ao 2º se
 * distribui uniformemente em [0°, 30°]. Então a fração de gente que vê a 27ª
 * pergunta é simplesmente `limiar / 30`:
 *
 *     limiar   |  quem vê a pergunta extra
 *     ---------|---------------------------
 *      3°      |  10%
 *      5°      |  17%
 *      8°      |  27%   ← atual
 *     12°      |  40%
 *
 * Medido em 20.000 respostas aleatórias: 26,2%, batendo com a previsão.
 *
 * A escolha de 8° é uma aposta em favor da autonomia: um quarto das pessoas
 * responde uma pergunta a mais, e em troca ninguém recebe um familiar que foi
 * decidido por um décimo de grau. Se o funil mostrar desistência nesse ponto,
 * baixar para 5° corta a incidência quase pela metade sem mexer em mais nada.
 */
export const LIMIAR_DE_EMPATE = 8;

/**
 * O limiar ampliado do Sapo. **Esta é uma decisão comercial, não estatística.**
 *
 * ── O que ela faz ─────────────────────────────────────────────────────────
 *
 * Quando o Sapo é o primeiro colocado, o empate é declarado com uma folga
 * maior que a normal — então a pessoa cai na 27ª pergunta e escolhe entre ele
 * e o segundo, em vez de receber o Sapo direto.
 *
 * ── O que ela NÃO faz, e por que isso importa ─────────────────────────────
 *
 * Ela **não** troca o resultado nem esconde o Sapo: ele continua aparecendo
 * como uma das duas opções, com o mesmo peso visual da outra, e quem quiser
 * fica com ele. Os 12 escores gravados continuam sendo os que o teste mediu —
 * `perfil_json` não é tocado. Ninguém é informado de nada falso.
 *
 * ── O custo, registrado aqui porque alguém vai perguntar ──────────────────
 *
 * O Sapo passa a ser subrepresentado nos resultados finais em relação ao que o
 * teste de fato mede, e essa assimetria vale só para ele. A distribuição
 * medida de 7,4%–9,2% entre os doze deixa de valer para o familiar entregue —
 * ela continua valendo para o placar. Se um dia a página de método afirmar
 * "todos têm a mesma chance", a afirmação precisa citar esta exceção.
 *
 * A origem é reclamação real de gente nos comentários. A alternativa mais
 * honesta seria reescrever o Sapo para ele parar de parecer um castigo — o que
 * resolveria a causa em vez do sintoma, e continua valendo a pena fazer.
 */
export const LIMIAR_DO_SAPO = 22;

/**
 * A partir de quantos respondentes a normalização passa a usar a base real.
 * O SPEC 2.5 usa ~200 como marco para rodar as métricas psicométricas; o mesmo
 * número serve aqui, pelo mesmo motivo: abaixo disso a média amostral balança
 * mais que a teórica.
 */
export const BASE_MINIMA_PARA_AMOSTRA = 200;

/** Soma as cargas das opções escolhidas. */
export function somarCargas(respostas: Respostas, itens: Item[] = ITENS): Escores {
  const total = escoresZerados();

  for (const item of itens) {
    const escolha = respostas[item.id];
    if (escolha === undefined) continue;

    const opcao = item.opcoes[escolha];
    if (!opcao) continue;

    for (const eixo of EIXOS) {
      total[eixo] += opcao.cargas[eixo] ?? 0;
    }
  }

  return total;
}

/**
 * Média e desvio teóricos do banco de itens, calculados **exatamente** — não
 * simulados.
 *
 * Se cada opção tem a mesma chance de ser escolhida, o escore de um eixo é uma
 * soma de variáveis independentes (uma por item). Então a média da soma é a
 * soma das médias, e a variância da soma é a soma das variâncias. Não há
 * necessidade de rodar Monte Carlo, e o resultado não tem ruído.
 *
 * Isso é um **prior**, não uma verdade sobre a população: pessoas reais não
 * escolhem uniformemente. Ele existe para o teste funcionar desde o primeiro
 * respondente, e sai de cena assim que houver base (ver `BASE_MINIMA_PARA_AMOSTRA`).
 */
export function normalizacaoTeorica(itens: Item[] = ITENS): Normalizacao {
  const media = {} as Record<Eixo, number>;
  const variancia = {} as Record<Eixo, number>;

  for (const eixo of EIXOS) {
    media[eixo] = 0;
    variancia[eixo] = 0;
  }

  for (const item of itens) {
    const n = item.opcoes.length;
    for (const eixo of EIXOS) {
      const cargas = item.opcoes.map((o) => o.cargas[eixo] ?? 0);
      const mediaDoItem = cargas.reduce((a, b) => a + b, 0) / n;
      const varDoItem =
        cargas.reduce((acc, c) => acc + (c - mediaDoItem) ** 2, 0) / n;
      media[eixo] += mediaDoItem;
      variancia[eixo] += varDoItem;
    }
  }

  const desvio = {} as Record<Eixo, number>;
  for (const eixo of EIXOS) {
    // piso defensivo: eixo sem nenhuma variação viraria divisão por zero
    desvio[eixo] = Math.max(Math.sqrt(variancia[eixo]), 1e-6);
  }

  return { media, desvio, base: 0, origem: 'teorica' };
}

/** z-score contra a base. */
export function normalizar(bruto: Escores, norma: Normalizacao): Escores {
  const saida = escoresZerados();
  for (const eixo of EIXOS) {
    saida[eixo] = (bruto[eixo] - norma.media[eixo]) / norma.desvio[eixo];
  }
  return saida;
}

/**
 * Roda o teste inteiro.
 *
 * `norma` é injetada em vez de lida de dentro: é o que mantém esta função
 * pura, testável sem banco, e o que permite recalcular perfis antigos contra a
 * base de hoje sem reescrever nada.
 */
export function pontuar(
  respostas: Respostas,
  opcoes: { norma?: Normalizacao; itens?: Item[] } = {}
): Resultado {
  const itens = opcoes.itens ?? ITENS;
  const norma = opcoes.norma ?? normalizacaoTeorica(itens);

  const bruto = somarCargas(respostas, itens);
  const normalizado = normalizar(bruto, norma);

  // Só os dois eixos principais definem a posição no círculo. Abertura e
  // estabilidade ficam de fora por decisão de projeto (SPEC 2.2).
  const { angulo, magnitude } = paraPolar(normalizado.agencia, normalizado.comunhao);

  const ranking = afinidades(angulo);
  const [primeiro, segundo] = ranking;

  // Empate é sobre o quanto o perfil está IGUALMENTE perto dos dois — não
  // sobre a distância entre os arquétipos, que é sempre 30° entre vizinhos.
  const diferenca = Math.abs(segundo.distancia - primeiro.distancia);

  // Ver LIMIAR_DO_SAPO: só quando ele é o primeiro colocado.
  const limiar = primeiro.familiar === 'sapo' ? LIMIAR_DO_SAPO : LIMIAR_DE_EMPATE;

  return {
    bruto,
    normalizado,
    angulo,
    magnitude,
    familiar: primeiro.familiar,
    afinidades: ranking,
    empate:
      diferenca < limiar
        ? {
            entre: [primeiro.familiar, segundo.familiar],
            diferenca: Math.round(diferenca * 10) / 10,
          }
        : null,
    normalizacao: norma,
  };
}
