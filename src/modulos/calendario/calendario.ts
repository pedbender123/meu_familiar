import type { AlcanceCalendario } from '../../nucleo/direitos';
import { mapaNatal, type MapaNatal } from './transitos';
import {
  pontuarDia,
  destaqueDo,
  classificar,
  type PontuacaoDoDia,
  type Dominio,
} from './pontuacao';

const UM_DIA_MS = 86_400_000;

export interface DiaDoCalendario {
  /** `YYYY-MM-DD` — chave estável, sem fuso embutido. */
  data: string;
  diaDoMes: number;
  pontuacao: PontuacaoDoDia;
  destaque: { dominio: Dominio; nota: number };
  classe: ReturnType<typeof classificar>;
}

/**
 * Quantos dias cada alcance abre.
 *
 * ── É aqui que o custo de CPU é decidido ──────────────────────────────────
 *
 * O plano grátis calcula 7 dias; o anual, 365. Como cada dia custa 7 leituras
 * de efeméride e nenhuma chamada de rede, o grátis é ruído (dezenas de
 * microssegundos) e o anual é da ordem de dezenas de milissegundos — pago uma
 * vez, por quem já pagou pelo plano.
 *
 * O importante é que a conta NUNCA roda além do que o plano dá: quem não tem
 * direito não gasta CPU nenhuma, porque `calendarioDaConta` sai antes.
 */
const DIAS_POR_ALCANCE: Record<AlcanceCalendario, number> = {
  nenhum: 0,
  semana: 7,
  mes: 31,
  ano: 365,
  rolante: 365,
};

export function diasDoAlcance(alcance: AlcanceCalendario): number {
  return DIAS_POR_ALCANCE[alcance];
}

function chaveDoDia(quando: Date): string {
  return `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, '0')}-${String(
    quando.getDate()
  ).padStart(2, '0')}`;
}

/**
 * O calendário de quem tem direito a ele.
 *
 * Devolve `null` quando o alcance é `nenhum` — e essa saída antecipada é o
 * que garante que plano sem calendário não consome CPU nenhuma. Quem chama
 * trata `null` como "não tem", não como "deu erro".
 *
 * `mes` e `rolante` diferem no ponto de partida, não no tamanho: `mes` mostra
 * o mês corrente (a pessoa vê os dias que já passaram, o que dá contexto),
 * `ano`/`rolante` começam em hoje e seguem em frente.
 */
export function calcularCalendario(
  natal: MapaNatal,
  alcance: AlcanceCalendario,
  hoje = new Date()
): DiaDoCalendario[] | null {
  const dias = diasDoAlcance(alcance);
  if (dias === 0) return null;

  const inicio =
    alcance === 'mes'
      ? new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      : new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const total =
    alcance === 'mes'
      ? new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
      : dias;

  const calendario: DiaDoCalendario[] = [];
  for (let i = 0; i < total; i++) {
    // Meio-dia em vez de meia-noite: perto da virada do dia, a Lua muda de
    // signo, e o meio do dia é mais representativo do que a fronteira dele.
    const quando = new Date(inicio.getTime() + i * UM_DIA_MS + 12 * 3_600_000);
    const pontuacao = pontuarDia(natal, quando);

    calendario.push({
      data: chaveDoDia(quando),
      diaDoMes: quando.getDate(),
      pontuacao,
      destaque: destaqueDo(pontuacao),
      classe: classificar(destaqueDo(pontuacao).nota),
    });
  }

  return calendario;
}

/**
 * A ponte entre a conta e o cálculo: junta dados de nascimento + alcance.
 *
 * Devolve `null` em três casos que a tela trata igual mas por motivos
 * diferentes — sem direito, sem data de nascimento, sem coordenada. Quem
 * chama diferencia pelo `perfilAstralDaConta`, que sabe dizer o que falta.
 */
export function calendarioDaConta(
  dados: {
    data: string | null;
    hora: string | null;
    lat: number | null;
    lon: number | null;
    horaAproximada: boolean;
  },
  alcance: AlcanceCalendario,
  hoje = new Date()
): DiaDoCalendario[] | null {
  if (diasDoAlcance(alcance) === 0) return null;
  if (!dados.data || dados.lat === null || dados.lon === null) return null;

  const natal = mapaNatal({
    data: dados.data,
    hora: dados.hora ?? '12:00',
    lat: dados.lat,
    lon: dados.lon,
    horaAproximada: dados.horaAproximada,
  });

  return calcularCalendario(natal, alcance, hoje);
}

/** Os melhores dias do período, para a tela destacar sem a pessoa ter que varrer o mês. */
export function diasDeOuro(calendario: DiaDoCalendario[], quantos = 5): DiaDoCalendario[] {
  return [...calendario]
    .filter((dia) => dia.classe === 'ouro')
    .sort((a, b) => b.destaque.nota - a.destaque.nota)
    .slice(0, quantos);
}
