import type { AlcanceCalendario } from '../../nucleo/direitos';
import { mapaNatal, type MapaNatal } from './transitos';
import {
  pontuarDia,
  destaqueDo,
  classificar,
  ehDiaDeOuro,
  ehDiaFechado,
  agregar,
  type PontuacaoDoDia,
  type Dominio,
  type Classe,
} from './pontuacao';
import { fraseDoDia, frasePeriodo } from './frases';

const UM_DIA_MS = 86_400_000;

/**
 * Um dia da grade.
 *
 * `liberado: false` é o **cadeado**: o dia existe, ocupa lugar na grade e
 * mostra o número, mas não foi calculado. Isso é de propósito em dois níveis
 * — economiza a CPU que o plano não pagou, e faz a pessoa ver o tamanho do
 * que está fechado. Grade que simplesmente termina no dia 7 parece um
 * calendário pequeno; grade cheia de cadeados parece um mês trancado.
 */
export interface DiaDoCalendario {
  data: string;
  diaDoMes: number;
  /** Dia da semana, 0 = domingo — a grade precisa alinhar a primeira linha. */
  diaDaSemana: number;
  liberado: boolean;
  pontuacao?: PontuacaoDoDia;
  destaque?: { dominio: Dominio; nota: number };
  classe?: Classe;
  /** `true` quando as quatro portas estão abertas — o dourado é só desses. */
  ouro?: boolean;
  fechado?: boolean;
  frase?: string;
}

export interface ResumoDePeriodo {
  porDominio: PontuacaoDoDia;
  geral: number;
  classe: Classe;
  frase: string;
}

export interface MesDoCalendario {
  /** `YYYY-MM` — o identificador do mês na navegação. */
  chave: string;
  ano: number;
  /** 0–11, como o `Date`. */
  mes: number;
  nome: string;
  dias: DiaDoCalendario[];
  /** `null` quando nenhum dia do mês foi calculado — não há o que resumir. */
  resumo: ResumoDePeriodo | null;
  /** As semanas do mês que têm dia calculado, para o resumo semanal. */
  semanas: { inicio: string; fim: string; resumo: ResumoDePeriodo }[];
  /** `false` = o mês inteiro está atrás de cadeado. */
  temDiaLiberado: boolean;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/**
 * Quantos dias **à frente de hoje** cada alcance libera.
 *
 * É aqui que o custo de CPU é decidido. Como cada dia custa 7 leituras de
 * efeméride e nenhuma chamada de rede, o grátis é ruído e o anual é dezenas
 * de milissegundos — pago uma vez, por quem já pagou pelo plano.
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

function meiaNoite(quando: Date): Date {
  return new Date(quando.getFullYear(), quando.getMonth(), quando.getDate());
}

function resumir(
  pontuacoes: PontuacaoDoDia[],
  tipo: 'semana' | 'mes',
  semente: string
): ResumoDePeriodo {
  const { porDominio, geral } = agregar(pontuacoes);
  const classe = classificar(geral);
  return { porDominio, geral, classe, frase: frasePeriodo(tipo, classe, semente) };
}

/**
 * Monta um mês inteiro, calculando só os dias que o plano libera.
 *
 * O alcance define uma **janela** que começa hoje e vai até `hoje + N dias`.
 * Dias do mês fora dessa janela — passados ou distantes demais — entram como
 * cadeado. O mês corrente é exceção parcial: dias já passados dele são
 * calculados quando o alcance é de mês ou mais, porque ver o que já passou dá
 * contexto ao que vem.
 */
export function calcularMes(
  natal: MapaNatal,
  alcance: AlcanceCalendario,
  ano: number,
  mes: number,
  hoje = new Date()
): MesDoCalendario {
  const dias: DiaDoCalendario[] = [];
  const pontuacoesDoMes: PontuacaoDoDia[] = [];

  const totalDeDias = new Date(ano, mes + 1, 0).getDate();
  const janela = DIAS_POR_ALCANCE[alcance];
  const inicioDaJanela = meiaNoite(hoje).getTime();
  const fimDaJanela = inicioDaJanela + (janela - 1) * UM_DIA_MS;

  // Quem tem mês ou mais enxerga o mês corrente inteiro, inclusive o que já
  // passou; quem só tem a semana enxerga estritamente os próximos 7 dias.
  const mesCorrente = ano === hoje.getFullYear() && mes === hoje.getMonth();
  const vePassadoDoMes = mesCorrente && janela >= 28;

  for (let dia = 1; dia <= totalDeDias; dia++) {
    const quando = new Date(ano, mes, dia, 12);
    const meiaNoiteDoDia = new Date(ano, mes, dia).getTime();

    const dentroDaJanela =
      meiaNoiteDoDia >= inicioDaJanela && meiaNoiteDoDia <= fimDaJanela;
    const liberado = janela > 0 && (dentroDaJanela || vePassadoDoMes);

    const base: DiaDoCalendario = {
      data: chaveDoDia(quando),
      diaDoMes: dia,
      diaDaSemana: quando.getDay(),
      liberado,
    };

    if (!liberado) {
      dias.push(base);
      continue;
    }

    const pontuacao = pontuarDia(natal, quando);
    const destaque = destaqueDo(pontuacao);
    const ouro = ehDiaDeOuro(pontuacao);
    const fechado = ehDiaFechado(pontuacao);

    pontuacoesDoMes.push(pontuacao);
    dias.push({
      ...base,
      pontuacao,
      destaque,
      classe: classificar(destaque.nota),
      ouro,
      fechado,
      frase: fraseDoDia(
        base.data,
        destaque.dominio,
        classificar(destaque.nota),
        ouro,
        fechado
      ),
    });
  }

  const chave = `${ano}-${String(mes + 1).padStart(2, '0')}`;

  // As semanas só existem onde há dia calculado — resumo de semana toda
  // bloqueada seria uma nota inventada sobre nada.
  const semanas: MesDoCalendario['semanas'] = [];
  let bloco: DiaDoCalendario[] = [];
  for (const dia of dias) {
    if (dia.liberado) bloco.push(dia);
    const fimDeSemana = dia.diaDaSemana === 6;
    if ((fimDeSemana || dia.diaDoMes === totalDeDias) && bloco.length > 0) {
      semanas.push({
        inicio: bloco[0].data,
        fim: bloco[bloco.length - 1].data,
        resumo: resumir(bloco.map((d) => d.pontuacao!), 'semana', bloco[0].data),
      });
      bloco = [];
    }
  }

  return {
    chave,
    ano,
    mes,
    nome: MESES[mes],
    dias,
    resumo:
      pontuacoesDoMes.length > 0 ? resumir(pontuacoesDoMes, 'mes', chave) : null,
    semanas,
    temDiaLiberado: pontuacoesDoMes.length > 0,
  };
}

/**
 * Os meses que a navegação oferece.
 *
 * Sempre devolve **12 meses a partir do corrente**, mesmo para o plano grátis
 * — os que ele não abre vêm com tudo bloqueado. É a mesma ideia do item de
 * menu apagado: mostrar o tamanho do que existe vende melhor que esconder.
 */
export function mesesNavegaveis(hoje = new Date()): { ano: number; mes: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });
}

/** A ponte entre a conta e o cálculo: junta dados de nascimento + alcance. */
export function mapaDaConta(dados: {
  data: string | null;
  hora: string | null;
  lat: number | null;
  lon: number | null;
  horaAproximada: boolean;
}): MapaNatal | null {
  if (!dados.data || dados.lat === null || dados.lon === null) return null;

  return mapaNatal({
    data: dados.data,
    hora: dados.hora ?? '12:00',
    lat: dados.lat,
    lon: dados.lon,
    horaAproximada: dados.horaAproximada,
  });
}

/** Os melhores dias do mês — só os que são bons em tudo. */
export function diasDeOuro(mes: MesDoCalendario, quantos = 5): DiaDoCalendario[] {
  return mes.dias
    .filter((dia) => dia.ouro)
    .sort((a, b) => (b.destaque?.nota ?? 0) - (a.destaque?.nota ?? 0))
    .slice(0, quantos);
}
