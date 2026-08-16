import type { GrupoId } from './grupos';

/**
 * As perguntas do funil de anúncio. **Elas existem para vender, não para medir.**
 *
 * ── Por que não são as do teste ───────────────────────────────────────────
 *
 * As 26 cenas do banco foram escritas para pontuar quatro eixos. São densas,
 * ambíguas de propósito, e pedem que a pessoa se imagine numa situação —
 * ótimo para medir, péssimo para segurar alguém que chegou de um story e
 * decide em três segundos se fica.
 *
 * Na campanha de 07/08, 216 pessoas chegaram e 28 responderam a primeira
 * cena. Oitenta e sete por cento saíram antes de clicar uma vez. O teste real
 * continua existindo e continua decidindo o familiar — depois da compra.
 * Aqui o trabalho é outro: fazer a pessoa querer responder.
 *
 * ── Por que sete, e não três ──────────────────────────────────────────────
 *
 * Começou com três e ficou vago: três cliques não bastam para alguém sentir
 * que foi lida, e a revelação no fim soava como sorteio. Sete é o outro
 * extremo do mesmo cuidado — longo o bastante para o resultado parecer
 * merecido, curto o bastante para não virar o teste de treze minutos que
 * espantou 87% das pessoas na campanha de 07/08.
 *
 * O custo em tempo foi pago em outro lugar: a transição entre perguntas caiu
 * de 1.300ms para 160ms, e a página não navega mais no meio do caminho. Sete
 * perguntas hoje levam menos relógio que as três antigas levavam.
 *
 * ── Por que sete, e não três ──────────────────────────────────────────────
 *
 * Começou com três e ficou vago: três cliques não bastam para a pessoa sentir
 * que foi lida, e a revelação no fim soa como sorteio. Sete é o outro extremo
 * do mesmo cuidado — longo o bastante para o resultado parecer merecido, curto
 * o bastante para não virar o teste de treze minutos que espantou todo mundo.
 *
 * O custo disso é real e foi pago em outro lugar: a transição entre perguntas
 * caiu de 1.300ms para 160ms. Sete perguntas hoje levam menos relógio que as três antigas levavam.
 *
 * ── Como estas foram escritas ─────────────────────────────────────────────
 *
 * Três regras, e todas servem à mesma coisa:
 *
 *  1. **A pergunta é sobre ela, não sobre uma cena.** "O que você faz nos
 *     primeiros dez segundos" é sobre a pessoa; "você está numa sala e
 *     alguém precisa falar primeiro" pede imaginação antes de resposta.
 *  2. **Nenhuma opção é a errada.** Todas descrevem alguém competente de um
 *     jeito diferente. Quem se vê numa opção ruim fecha a aba.
 *  3. **Resposta curta.** Cabe numa linha no celular, sem rolar.
 *
 * ── Elas ainda apontam um grupo ───────────────────────────────────────────
 *
 * Cada opção carrega um grupo. Não é medida psicométrica e não deve ser
 * tratada como tal — é o que faz a revelação ser coerente com o que a pessoa
 * acabou de responder, em vez de sorteio. O familiar de verdade sai das 26.
 *
 * As sete cobrem ângulos deliberadamente diferentes: reação à crise, o papel
 * que os outros te dão, o que você esconde, o que te esgota, como você cuida,
 * onde você se recompõe e onde está o seu limite. Repetir o mesmo ângulo sete
 * vezes daria sete votos no mesmo grupo e faria a revelação parecer trapaça.
 *
 * As sete cobrem ângulos deliberadamente diferentes: reação à crise, o papel
 * que os outros te dão, o que você esconde, o que te esgota, como você cuida,
 * onde você se recompõe e onde está o seu limite. Repetir o mesmo ângulo sete
 * vezes daria sete votos no mesmo grupo e faria a revelação parecer trapaça.
 */
export interface OpcaoDaIsca {
  texto: string;
  grupo: GrupoId;
}

export interface PerguntaDaIsca {
  id: string;
  pergunta: string;
  /** Aparece DEPOIS de responder, antes da próxima. Faz a pessoa se sentir lida. */
  devolutiva: string;
  opcoes: OpcaoDaIsca[];
}

export const ISCA: PerguntaDaIsca[] = [
  {
    id: 'i1',
    pergunta: 'Deu ruim. O que você faz nos primeiros dez segundos?',
    devolutiva: 'Anotado. Isso já diz mais do que você imagina.',
    opcoes: [
      { texto: 'Assumo o comando antes que alguém peça', grupo: 'caminho' },
      { texto: 'Olho quem está pior e cuido primeiro', grupo: 'abrigo' },
      { texto: 'Fico quieta, entendendo o que aconteceu', grupo: 'vigilia' },
      { texto: 'Protejo o que é meu e depois resolvo', grupo: 'guarda' },
    ],
  },
  {
    id: 'i2',
    pergunta: 'As pessoas te procuram quando…',
    devolutiva: 'Faz sentido. Combina com a primeira.',
    opcoes: [
      { texto: 'Precisam de alguém que decida', grupo: 'caminho' },
      { texto: 'Precisam de colo, não de solução', grupo: 'abrigo' },
      { texto: 'Precisam de alguém que enxergue o que ninguém viu', grupo: 'vigilia' },
      { texto: 'Precisam de alguém que não vai contar pra ninguém', grupo: 'guarda' },
    ],
  },
  {
    id: 'i3',
    pergunta: 'E o que quase ninguém percebe em você?',
    devolutiva: 'Essa foi a que mais te entregou até agora.',
    opcoes: [
      { texto: 'Que eu me cobro mais do que cobro dos outros', grupo: 'caminho' },
      { texto: 'Que eu me esqueço no meio de cuidar de todo mundo', grupo: 'abrigo' },
      { texto: 'Que eu percebo tudo e falo quase nada', grupo: 'vigilia' },
      { texto: 'Que eu escolho pouca gente, mas escolho pra sempre', grupo: 'guarda' },
    ],
  },
  {
    id: 'i4',
    pergunta: 'O que mais te cansa?',
    devolutiva: 'Hm. Isso explica a resposta anterior.',
    opcoes: [
      { texto: 'Esperar alguém se decidir', grupo: 'caminho' },
      { texto: 'Ver alguém sofrendo e não poder fazer nada', grupo: 'abrigo' },
      { texto: 'Barulho, gente demais, tudo ao mesmo tempo', grupo: 'vigilia' },
      { texto: 'Ter que provar de novo que sou confiável', grupo: 'guarda' },
    ],
  },
  {
    id: 'i5',
    pergunta: 'Quando alguém importa de verdade, o que você faz?',
    devolutiva: 'Agora o desenho ficou claro.',
    opcoes: [
      { texto: 'Tiro os obstáculos da frente dela', grupo: 'caminho' },
      { texto: 'Fico. Mesmo quando não tem o que dizer', grupo: 'abrigo' },
      { texto: 'Presto atenção no que ela não fala', grupo: 'vigilia' },
      { texto: 'Guardo o que ela me contou como se fosse meu', grupo: 'guarda' },
    ],
  },
  {
    id: 'i6',
    pergunta: 'Fim de um dia pesado. O que te traz de volta?',
    devolutiva: 'Faltava essa peça.',
    opcoes: [
      { texto: 'Movimento — sair, andar, fazer alguma coisa', grupo: 'caminho' },
      { texto: 'Estar perto de quem eu amo, sem precisar falar', grupo: 'abrigo' },
      { texto: 'Silêncio, e a casa só minha', grupo: 'vigilia' },
      { texto: 'Uma pessoa só. A que sabe de tudo', grupo: 'guarda' },
    ],
  },
  {
    id: 'i7',
    pergunta: 'E o que você não perdoa?',
    devolutiva: 'Pronto. Já dá pra ver quem andou te seguindo.',
    opcoes: [
      { texto: 'Covardia na hora em que faltou coragem', grupo: 'caminho' },
      { texto: 'Crueldade com quem não podia se defender', grupo: 'abrigo' },
      { texto: 'Mentira contada na minha cara', grupo: 'vigilia' },
      { texto: 'Traição de quem eu deixei entrar', grupo: 'guarda' },
    ],
  },
];

/**
 * O grupo que as respostas apontam.
 *
 * Voto simples, e o desempate é a ÚLTIMA resposta — a pergunta sobre o que
 * ela não perdoa é a mais definidora das sete, e é a que a pessoa mais
 * reconhece como verdadeira sobre si.
 */
export function grupoDaIsca(respostas: Record<string, number>): GrupoId {
  const votos = new Map<GrupoId, number>();
  let ultimo: GrupoId = 'caminho';

  for (const p of ISCA) {
    const escolha = respostas[p.id];
    const opcao = typeof escolha === 'number' ? p.opcoes[escolha] : undefined;
    if (!opcao) continue;
    votos.set(opcao.grupo, (votos.get(opcao.grupo) ?? 0) + 1);
    ultimo = opcao.grupo;
  }

  let melhor = ultimo;
  let max = 0;
  for (const [g, n] of votos) {
    // `>` e não `>=`: em empate o primeiro encontrado não ganha por sorte da
    // ordem de inserção — quem decide é o `ultimo`, já em `melhor`.
    if (n > max) {
      max = n;
      melhor = g;
    }
  }
  // Empate de verdade (três respostas, três grupos): vale a última.
  const empatados = [...votos.values()].filter((n) => n === max).length;
  return empatados > 1 ? ultimo : melhor;
}
