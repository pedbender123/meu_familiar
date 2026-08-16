const JANELA_MS = 60_000;

/** Rotas que não passam limite próprio. Escrita de formulário, uma por vez. */
export const LIMITE_PADRAO = 10;

const contagens = new Map<string, { count: number; expiraEm: number }>();

/**
 * Balde de requisições por chave, na janela de um minuto.
 *
 * ── A chave precisa incluir a rota ────────────────────────────────────────
 *
 * Dez rotas chamavam isto passando só o IP, então todas dividiam um balde de
 * dez. O efeito era o pior possível e invisível: os beacons de analítica
 * (`/api/marcacao`, `/api/progresso`) disparam sozinhos durante a navegação e
 * gastavam a cota que a pessoa precisava para **criar a cobrança**. Alguém
 * podia ser barrado de pagar porque o próprio site contou os passos dela.
 *
 * Agora cada rota tem o seu balde, e o limite é dimensionado pelo uso real —
 * ver `LIMITES`.
 *
 * ── O limite do ritual não é por IP ───────────────────────────────────────
 *
 * O ritual pago faz uma requisição POR CENA: vinte e seis, mais as falas das
 * paradas. Com dez por minuto, nenhum cliente terminaria — e o teste local
 * confirmou, travando na oitava cena. Ele é limitado pelo id do pedido, que
 * já custou dinheiro para existir; usar o IP puniria duas pessoas na mesma
 * rede de celular ou no mesmo escritório.
 *
 * ── O que isto NÃO é ──────────────────────────────────────────────────────
 *
 * Um Map em memória de um processo só. Reinício zera, e não vale entre
 * instâncias. É freio contra script bobo e clique repetido, não defesa contra
 * ataque distribuído — para isso o lugar é a borda, não aqui.
 */
export function excedeuLimite(chave: string, limite: number = LIMITE_PADRAO): boolean {
  const agora = Date.now();
  const registro = contagens.get(chave);

  if (!registro || registro.expiraEm < agora) {
    contagens.set(chave, { count: 1, expiraEm: agora + JANELA_MS });
    limparVencidos(agora);
    return false;
  }

  registro.count += 1;
  return registro.count > limite;
}

/** Limites por rota, em requisições por minuto. */
export const LIMITES = {
  /** 26 cenas + 2 falas + reenvio de rede instável, com folga. */
  ritual: 120,
  /** Beacons de navegação. Disparam sozinhos, e não podem competir com nada. */
  analitica: 90,
  /** Criar cobrança. Poucas por minuto é o uso honesto; mais é cartão testado. */
  pagamento: 8,
} as const;

/**
 * Varre o que já venceu.
 *
 * Sem isto o Map só cresce: cada IP que passou uma vez pelo site fica na
 * memória do processo para sempre. Roda só quando uma chave nova entra, então
 * o custo acompanha o tráfego em vez de um timer ocioso.
 */
function limparVencidos(agora: number): void {
  if (contagens.size < 500) return;
  for (const [chave, registro] of contagens) {
    if (registro.expiraEm < agora) contagens.delete(chave);
  }
}
