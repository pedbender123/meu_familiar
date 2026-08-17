import * as Astronomy from 'astronomy-engine';
import { longitudeParaSigno, type Signo } from '../lib/astro';

/**
 * O céu de hoje — calculado, sem IA e sem rede.
 *
 * ── Por que determinístico, e por que isso é uma decisão de negócio ───────
 *
 * Este bloco aparece na tela inicial de todo mundo, todo dia, inclusive do
 * plano grátis. Se cada visita custasse uma chamada de modelo, o custo
 * cresceria com o engajamento — ou seja, quanto melhor o produto funcionasse,
 * mais caro ficaria. É exatamente o inverso do que se quer.
 *
 * `astronomy-engine` já é dependência do projeto e dá posição planetária para
 * qualquer data sem API e sem custo. O texto sai de tabela, não de modelo: a
 * mesma data devolve sempre a mesma coisa, o que também torna isto testável.
 *
 * O Oráculo (Fase 8/9) é onde a IA entra, e é onde ela se paga.
 */
export interface CeuDoDia {
  /** Onde a Lua está hoje — o que muda mais rápido e o que mais se sente. */
  luaEm: Signo;
  faseDaLua: 'nova' | 'crescente' | 'cheia' | 'minguante';
  /**
   * A elongação em graus (0 nova, 90 quarto crescente, 180 cheia, 270
   * minguante). Fica exposta porque o desenho da lua precisa do valor
   * contínuo — quatro nomes de fase desenhariam quatro luas, e a de verdade
   * muda um pouco todo dia.
   */
  grausDaFase: number;
  /** Fração iluminada, 0–1 — é o que o desenho usa direto. */
  iluminacao: number;
  /** Nome da fase, como se fala. */
  faseNome: string;
  /** Uma linha sobre o clima do dia, derivada da fase. */
  clima: string;
  /** `true` quando a Lua está no mesmo signo da Lua natal — dia de virada. */
  luaEmCasa: boolean;
}

const NOME_DA_FASE: Record<CeuDoDia['faseDaLua'], string> = {
  nova: 'Lua nova',
  crescente: 'Lua crescente',
  cheia: 'Lua cheia',
  minguante: 'Lua minguante',
};

/**
 * O clima de cada fase.
 *
 * Escrito como convite, não como previsão: "bom dia para começar" é uma
 * sugestão que a pessoa aceita ou não; "hoje você vai começar algo" é uma
 * afirmação que o produto não pode sustentar — e que, quando falha, custa a
 * credibilidade do resto.
 */
const CLIMA_DA_FASE: Record<CeuDoDia['faseDaLua'], string> = {
  nova: 'Começo de ciclo. Bom dia para plantar o que ninguém precisa ver ainda.',
  crescente: 'O que você começou está pedindo movimento. Empurre um pouco.',
  cheia: 'Tudo fica visível hoje — inclusive o que você vinha evitando olhar.',
  minguante: 'Dia de soltar. O que está pesando não precisa atravessar a semana.',
};

export function ceuDoDia(quando: Date = new Date(), luaNatal?: Signo | null): CeuDoDia {
  const lua = Astronomy.EclipticGeoMoon(quando);
  const luaEm = longitudeParaSigno(lua.lon);

  const graus = Astronomy.MoonPhase(quando);
  const faseDaLua: CeuDoDia['faseDaLua'] =
    graus < 45 || graus >= 315
      ? 'nova'
      : graus < 135
        ? 'crescente'
        : graus < 225
          ? 'cheia'
          : 'minguante';

  return {
    luaEm,
    faseDaLua,
    grausDaFase: graus,
    // A fase varia como (1 - cos) / 2: nova = 0, cheia = 1.
    iluminacao: (1 - Math.cos((graus * Math.PI) / 180)) / 2,
    faseNome: NOME_DA_FASE[faseDaLua],
    clima: CLIMA_DA_FASE[faseDaLua],
    // O retorno lunar acontece ~1 vez por mês e é o trânsito mais fácil de
    // sentir — vale destacar quando cai.
    luaEmCasa: !!luaNatal && luaNatal === luaEm,
  };
}
