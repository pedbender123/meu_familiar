import { FAMILIARES, type FamiliarId } from '../familiares';
import type { Resultado } from './pontuacao';

/**
 * A 27ª pergunta (SPEC 2.4).
 *
 * Aparece **só** quando dois arquétipos ficam dentro do limiar de empate, e
 * existe por uma razão de produto, não de estatística: o incômodo relatado no
 * SPEC 2.1 era "não parece que as perguntas definem o familiar, e sim o signo".
 * Trocar o desempate por signo pelo desempate por escolha resolve isso pela
 * raiz — quem define passa a ser a pessoa.
 *
 * Duas regras que não devem ser afrouxadas:
 *
 *  1. **Só os dois empatados aparecem.** Oferecer os 12 transformaria o teste
 *     inteiro num menu, e aí ele não mede nada.
 *  2. **Nenhum dos dois é apresentado como o "certo".** Nada de "você ficou
 *     mais perto do Corvo, mas...". A pessoa escolhe às cegas quanto ao
 *     placar, senão a informação de proximidade decide por ela.
 */
export interface OpcaoDeDesempate {
  familiar: FamiliarId;
  nome: string;
  /** Frase na voz do arquétipo. Nunca diz quem estava ganhando. */
  chamado: string;
}

/**
 * O chamado de cada familiar no desempate: uma frase em primeira pessoa, do
 * bicho para a pessoa. É o único lugar do teste em que os arquétipos falam.
 */
const CHAMADO: Record<FamiliarId, string> = {
  raposa: 'Eu te mostro a porta que ninguém viu. Você só precisa querer sair.',
  lebre: 'Comigo é rápido, e é agora. Depois a gente pensa no resto.',
  lobo: 'Eu fico. Mesmo quando for feio, principalmente quando for feio.',
  cervo: 'Comigo você pode chegar cansada. Não vou te apressar.',
  mariposa: 'Eu vou junto na direção da luz, mesmo sabendo que queima.',
  sapo: 'Eu espero o tempo que for. O que tem que mudar, muda sozinho.',
  morcego: 'Eu escuto o que você não disse. É só o que eu faço.',
  coruja: 'Eu enxergo no escuro. Vou te contar o que vi, sem enfeitar.',
  aranha: 'Eu teço devagar. Quando você olhar, já vai estar pronto.',
  'gata-preta': 'Eu escolho pouca gente. Escolhi você, e isso não muda.',
  serpente: 'Eu já fui outra coisa antes. Posso te ensinar a sair da pele.',
  corvo: 'Eu guardo tudo. Um dia você vai precisar que alguém tenha guardado.',
};

/** Monta as duas opções do desempate, em ordem aleatória. */
export function opcoesDeDesempate(resultado: Resultado): OpcaoDeDesempate[] | null {
  if (!resultado.empate) return null;

  const opcoes = resultado.empate.entre.map((familiar) => ({
    familiar,
    nome: FAMILIARES[familiar].nome,
    chamado: CHAMADO[familiar],
  }));

  // Embaralhar importa: mostrar sempre o vencedor do placar primeiro daria a
  // ele a vantagem de posição, e o desempate deixaria de ser da pessoa.
  return Math.random() < 0.5 ? opcoes : [opcoes[1], opcoes[0]];
}

/**
 * Aplica a escolha da pessoa ao resultado.
 *
 * O resultado numérico **não é reescrito** — os 12 escores continuam sendo o
 * que o teste mediu. O que muda é o familiar. Essa separação é o que permite,
 * depois, responder à pergunta que a seção 2.5 do SPEC vai fazer: quando as
 * pessoas desempatam, elas escolhem o que o placar já dizia, ou o contrário?
 */
export function aplicarDesempate(
  resultado: Resultado,
  escolhido: FamiliarId
): Resultado & { desempatadoPelaPessoa: boolean } {
  const eraOpcao = resultado.empate?.entre.includes(escolhido);
  if (!eraOpcao) {
    // Escolha fora das duas opções: ignora em silêncio e mantém o placar.
    // Recusar seria perder o quiz inteiro por causa de um parâmetro adulterado.
    return { ...resultado, desempatadoPelaPessoa: false };
  }

  return {
    ...resultado,
    familiar: escolhido,
    desempatadoPelaPessoa: escolhido !== resultado.familiar,
  };
}
