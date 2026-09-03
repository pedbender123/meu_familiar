/**
 * A carência do download — sete dias entre pagar e poder guardar o arquivo.
 *
 * ── Por que o arquivo deixou de sair na hora ──────────────────────────────
 *
 * O produto virou a plataforma. Enquanto o PDF saía junto da entrega, o
 * caminho mais curto para quem comprava era baixar, fechar a aba e nunca mais
 * voltar — e a versão desse gesto que dói é baixar, guardar e pedir estorno
 * dentro do prazo legal de arrependimento. O dinheiro volta, o arquivo fica.
 *
 * Não é desconfiança do cliente: é que oferecer o download no primeiro
 * minuto ensina a pessoa a tratar como arquivo uma coisa que é um lugar. Quem
 * fica sete dias já leu dentro do app, já viu o Oráculo, o calendário e a
 * estante — e o download deixa de ser a saída para virar a lembrança.
 *
 * ── Sete dias, e não trinta ───────────────────────────────────────────────
 *
 * Sete é o prazo de arrependimento do Código de Defesa do Consumidor para
 * compra a distância. Depois dele o estorno deixa de ser um direito
 * automático, e é exatamente aí que o arquivo pode ir embora com a pessoa
 * sem que a loja pague duas vezes pela mesma venda.
 *
 * ── Quem nunca abre ───────────────────────────────────────────────────────
 *
 * Quem não pagou. Cortesia, entrega gratuita e o que a assinatura destranca
 * não geram direito a arquivo: a assinatura dá acesso enquanto durar, e um
 * PDF na mão de quem cancelou no mês seguinte é o contrário disso. Sem data
 * de pagamento, a resposta é "nunca" — nunca é o padrão seguro.
 */

/** O prazo de arrependimento do CDC. Ver o comentário acima. */
export const DIAS_DE_CARENCIA = 7;

const UM_DIA = 86_400_000;

export interface EstadoDoDownload {
  /** Pode baixar agora. */
  liberado: boolean;
  /** Quando abre, em ISO. `null` = não abre nunca (não houve compra). */
  abreEm: string | null;
  /** Quantos dias faltam, arredondados para cima. `0` quando já abriu. */
  diasQueFaltam: number;
}

/**
 * `pagoEm` é a data do dinheiro, não a da entrega — é ela que começa a contar
 * o prazo de arrependimento, e é ela que o estorno olharia.
 */
export function estadoDoDownload(
  pagoEm: string | null | undefined,
  agora: Date = new Date()
): EstadoDoDownload {
  if (!pagoEm) return { liberado: false, abreEm: null, diasQueFaltam: 0 };

  const pago = new Date(pagoEm).getTime();
  // Data ilegível é tratada como ausência de compra, e não como compra antiga:
  // o erro caro aqui é liberar, não segurar.
  if (Number.isNaN(pago)) return { liberado: false, abreEm: null, diasQueFaltam: 0 };

  const abre = pago + DIAS_DE_CARENCIA * UM_DIA;
  const falta = abre - agora.getTime();

  return {
    liberado: falta <= 0,
    abreEm: new Date(abre).toISOString(),
    diasQueFaltam: falta <= 0 ? 0 : Math.ceil(falta / UM_DIA),
  };
}

/** O atalho para as rotas, que só precisam do sim ou não. */
export function podeBaixar(pagoEm: string | null | undefined, agora?: Date): boolean {
  return estadoDoDownload(pagoEm, agora).liberado;
}
