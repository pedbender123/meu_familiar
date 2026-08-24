/**
 * Os UTMs que o script da Utmify guardou, ou os da URL atual.
 *
 * Viajam junto da cobrança para caírem também no painel do gateway — a
 * Utmify recebe pelo servidor, mas ter a origem nos dois lugares é o que
 * permite conferir um contra o outro quando os números não baterem.
 *
 * Morava dentro do checkout da Cakto. Saiu de lá quando o segundo gateway
 * precisou do mesmo: rastreio duplicado é rastreio que diverge, e o dia em
 * que os dois discordarem é o dia em que ninguém vai saber qual acreditar.
 */
export function utmsDaSessao(): Record<string, string> {
  const utm: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const chave of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
      const valor = params.get(chave) ?? localStorage.getItem(`bruxario:${chave}`);
      if (valor) utm[chave] = valor;
    }
  } catch {
    // Sem UTM a venda acontece igual; ela só aparece como direta no relatório.
  }
  return utm;
}
