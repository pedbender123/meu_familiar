import { buscarPlano, direitosDoPlano, type Plano } from './planos';
import type { Direitos } from './direitos';

/**
 * A oferta que aparece logo depois do ritual.
 *
 * ── Por que ela é uma lista fixa, e não a vitrine ─────────────────────────
 *
 * A `/planos` mostra o que está à venda para quem já decidiu ficar: são
 * assinaturas, comparadas entre si, com a promessa de permanência. Esta tela
 * é outra coisa — é o único momento em que a pessoa está com a atenção
 * inteira aqui, logo depois de treze minutos de ritual, e o que se vende é
 * **entrega rápida**: o texto da revelação que ela acabou de merecer.
 *
 * Se as duas lessem a mesma fonte, qualquer plano novo apareceria nas duas, e
 * a tela de maior atenção do funil viraria uma tabela comparativa de seis
 * linhas. Aqui são três opções, nessa ordem, e nada mais.
 *
 * ── Por que a recorrente é a última ───────────────────────────────────────
 *
 * As duas avulsas são a decisão fácil (compra única, acesso para sempre); a
 * recorrente é a decisão que exige confiança. Pôr a recorrente antes faria a
 * pessoa avaliar um compromisso mensal antes de ter avaliado sete reais — e
 * quem recusa o compromisso tende a recusar a tela inteira junto.
 */
export const PLANOS_DA_OFERTA = [
  'avulsa_simples',
  'avulsa_completa',
  'revelacao_mensal',
] as const;

export type PlanoDaOfertaId = (typeof PLANOS_DA_OFERTA)[number];

export function ehPlanoDaOferta(id: string): id is PlanoDaOfertaId {
  return (PLANOS_DA_OFERTA as readonly string[]).includes(id);
}

export interface ItemDaOferta {
  plano: Plano;
  direitos: Direitos;
  /** `true` para a recorrente — muda o rótulo do preço e o destaque. */
  recorrente: boolean;
  /** O que esta opção acrescenta à anterior. Ver `escadaDaOferta`. */
  ganhos: string[];
  /** A frase que diz para quem é. Escrita à mão: é copy de venda, não dado. */
  chamada: string;
}

const CHAMADAS: Record<PlanoDaOfertaId, string> = {
  avulsa_simples: 'A leitura do seu familiar, para guardar.',
  avulsa_completa: 'A leitura longa, com o retrato inteiro do que o teste viu.',
  revelacao_mensal: 'Tudo isso, e o Bruxário aberto todo dia.',
};

/**
 * O que cada degrau **acrescenta** ao anterior.
 *
 * Escrito à mão, e não derivado dos direitos como faz a vitrine, porque aqui
 * o objetivo é diferente: a vitrine precisa nunca prometer o que o acesso não
 * dá (por isso deriva), e esta tela precisa que a diferença entre 7,90 e
 * 15,90 caiba em três linhas que alguém lê em pé, no celular, com pressa.
 *
 * A honestidade é garantida de outro jeito: `verificarEscada` roda em teste e
 * quebra o build se alguma linha aqui prometer algo que os direitos do plano
 * não liberam.
 */
const GANHOS: Record<PlanoDaOfertaId, string[]> = {
  avulsa_simples: [
    'O texto completo da sua revelação',
    'PDF e imagens para baixar',
    'Calendário da semana inteira',
  ],
  avulsa_completa: [
    'O relatório longo do seu perfil',
    'Os gráficos dos quatro eixos',
    'Sua leitura narrada em áudio',
  ],
  revelacao_mensal: [
    '10 leituras do Oráculo por mês',
    '60 mensagens, com resposta na hora',
    'Calendário dos 6 meses à frente',
    'O guia da sua semana, no seu e-mail',
  ],
};

/**
 * As três opções, na ordem da tela.
 *
 * Devolve só o que existe e está ativo: plano desativado some da oferta em
 * vez de derrubar a página — esta tela está no caminho do dinheiro, e ela
 * ficar de pé com duas opções é infinitamente melhor do que dar 500.
 */
export function escadaDaOferta(): ItemDaOferta[] {
  const itens: ItemDaOferta[] = [];

  for (const id of PLANOS_DA_OFERTA) {
    const plano = buscarPlano(id);
    if (!plano || !plano.ativo) continue;

    itens.push({
      plano,
      direitos: direitosDoPlano(plano),
      recorrente: !!plano.recorrente,
      ganhos: GANHOS[id],
      chamada: CHAMADAS[id],
    });
  }

  return itens;
}
