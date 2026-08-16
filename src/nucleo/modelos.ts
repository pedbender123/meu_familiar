/**
 * Qual modelo faz qual tarefa — e o preço de cada um.
 *
 * ── Por que isto não é uma constante no arquivo que usa ───────────────────
 *
 * Era: `const MODELO = 'gemini-3.5-flash-lite'` no topo de `leitura.ts`,
 * repetido em cada arquivo que chama IA. Isso torna "trocar de modelo" uma
 * mudança de código com deploy, quando na prática é uma decisão de custo que
 * se toma olhando a fatura e se reverte no mesmo dia.
 *
 * As tarefas têm exigências diferentes o bastante pra não caber num modelo
 * só: a leitura da revelação é o produto (vale pagar mais), o conselho do
 * Oráculo é o que justifica a assinatura, e a fila do plano grátis precisa
 * caber num tier gratuito. Um modelo só para as três ou gasta demais na
 * barata ou entrega de menos na cara.
 *
 * ── Sobre o custo ─────────────────────────────────────────────────────────
 *
 * `centavosPorMilhaoDeTokens` existe pra `eventos` conseguir gravar margem
 * por plano (Fase 11) sem ninguém consultar tabela de preço à mão. É uma
 * ESTIMATIVA declarada por quem configurou — o número real vem da fatura do
 * provedor, e quando os dois divergirem, quem está errado é este arquivo.
 */
export type Tarefa = 'leitura' | 'oraculo' | 'oraculo_fila' | 'copy' | 'teaser';

export interface Modelo {
  /** O identificador que vai para a API do provedor. */
  id: string;
  provedor: 'google' | 'openai';
  entradaCentavosPorMilhao: number;
  saidaCentavosPorMilhao: number;
}

/**
 * O padrão de cada tarefa. Sobrescrevível por variável de ambiente —
 * `BRUXARIO_MODELO_ORACULO=gpt-5.6-luna` troca só o Oráculo, sem tocar no
 * resto e sem rebuild.
 *
 * Os preços aqui são os que estavam valendo quando cada tarefa foi
 * configurada. **Conferir na fatura antes de confiar** — preço de modelo
 * muda sem aviso, e um número velho aqui vira margem calculada errada na
 * Fase 11.
 */
const PADRAO: Record<Tarefa, Modelo> = {
  // O produto que a pessoa pagou pra ler. É onde vale gastar mais.
  leitura: {
    id: 'gemini-3.5-flash-lite',
    provedor: 'google',
    entradaCentavosPorMilhao: 0,
    saidaCentavosPorMilhao: 0,
  },
  oraculo: {
    id: 'gemini-3.5-flash-lite',
    provedor: 'google',
    entradaCentavosPorMilhao: 0,
    saidaCentavosPorMilhao: 0,
  },
  // A fila do plano grátis: aqui o critério é caber no tier gratuito, não
  // ser o melhor modelo. Resposta boa e barata ganha de resposta ótima e cara.
  oraculo_fila: {
    id: 'gemini-3.5-flash-lite',
    provedor: 'google',
    entradaCentavosPorMilhao: 0,
    saidaCentavosPorMilhao: 0,
  },
  copy: {
    id: 'gemini-3.5-flash-lite',
    provedor: 'google',
    entradaCentavosPorMilhao: 0,
    saidaCentavosPorMilhao: 0,
  },
  teaser: {
    id: 'gemini-3.5-flash-lite',
    provedor: 'google',
    entradaCentavosPorMilhao: 0,
    saidaCentavosPorMilhao: 0,
  },
};

/** `BRUXARIO_MODELO_ORACULO_FILA`, `BRUXARIO_MODELO_LEITURA`, etc. */
export function modeloDa(tarefa: Tarefa): Modelo {
  const padrao = PADRAO[tarefa];
  const doAmbiente = process.env[`BRUXARIO_MODELO_${tarefa.toUpperCase()}`]?.trim();
  if (!doAmbiente) return padrao;

  // Só o id muda pelo ambiente: preço e provedor continuam os declarados, e
  // é por isso que trocar de modelo por variável pede revisita a este
  // arquivo depois — senão a margem da Fase 11 é calculada com o preço do
  // modelo antigo, e ninguém percebe.
  return { ...padrao, id: doAmbiente };
}

/** O custo estimado de uma chamada, pra gravar junto do evento. */
export function custoEstimadoCentavos(
  modelo: Modelo,
  tokensEntrada: number,
  tokensSaida: number
): number {
  const entrada = (tokensEntrada / 1_000_000) * modelo.entradaCentavosPorMilhao;
  const saida = (tokensSaida / 1_000_000) * modelo.saidaCentavosPorMilhao;
  return Math.round(entrada + saida);
}
