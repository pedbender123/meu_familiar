/**
 * Um intervalo de tempo com precisão de minuto, para o painel.
 *
 * ── Por que não reusar a `Janela` do analitica.ts ─────────────────────────
 *
 * Aquela é um menu fechado (hoje / 7d / 30d / tudo) e serve bem para "como
 * estamos indo". Mas campanha de tráfego não roda em dia inteiro: sobe às
 * 19h40 e para às 23h15, e a pergunta é o que aconteceu NESSA janela. Um
 * filtro de dias não responde isso — e arredondar para o dia inteiro
 * misturaria o tráfego orgânico da manhã com o pago da noite.
 *
 * ── Fuso ──────────────────────────────────────────────────────────────────
 *
 * O banco guarda ISO em UTC. O painel é operado do Brasil e o `datetime-local`
 * do navegador não manda fuso nenhum — manda "2026-08-07T19:40" e pronto.
 * Então tudo que entra por aqui é interpretado como horário de Brasília
 * (UTC-3) e convertido; tudo que sai para a tela é convertido de volta. Sem
 * isso o filtro erraria por três horas, calado.
 */

const FUSO_BR = -3;

export interface Periodo {
  /** ISO UTC, inclusivo. */
  de: string;
  /** ISO UTC, exclusivo. */
  ate: string;
  rotulo: string;
}

export type Preset = 'agora' | 'hoje' | '24h' | '7d' | '30d' | 'tudo';

export const PRESETS: { id: Preset; rotulo: string }[] = [
  { id: 'agora', rotulo: 'Última hora' },
  { id: 'hoje', rotulo: 'Hoje' },
  { id: '24h', rotulo: '24 horas' },
  { id: '7d', rotulo: '7 dias' },
  { id: '30d', rotulo: '30 dias' },
  { id: 'tudo', rotulo: 'Tudo' },
];

export function ehPreset(v: unknown): v is Preset {
  return typeof v === 'string' && PRESETS.some((p) => p.id === v);
}

/** "2026-08-07T19:40" (horário de Brasília) → ISO UTC. */
export function deLocalParaUtc(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [, a, mes, d, h, min] = m;
  return new Date(
    Date.UTC(+a, +mes - 1, +d, +h - FUSO_BR, +min)
  ).toISOString();
}

/** ISO UTC → "2026-08-07T19:40", que é o que o input datetime-local aceita. */
export function deUtcParaLocal(iso: string): string {
  const d = new Date(new Date(iso).getTime() + FUSO_BR * 3600_000);
  return d.toISOString().slice(0, 16);
}

/**
 * "Agora" no formato do `datetime-local`, em horário de Brasília.
 *
 * **Nunca chame isto durante o render** — é impura por definição (lê o
 * relógio), e o React 19 recusa. O lugar dela é dentro de um handler de
 * evento: quando você clica em "nova campanha" ou "encerrar agora".
 */
export function agoraEmBrasilia(): string {
  return deUtcParaLocal(new Date().toISOString());
}

/** Só a hora e o minuto, para rótulo de gráfico e de tabela. */
export function horaMinuto(iso: string): string {
  return deUtcParaLocal(iso).slice(11);
}

export function dataHoraBr(iso: string): string {
  const l = deUtcParaLocal(iso);
  return `${l.slice(8, 10)}/${l.slice(5, 7)} ${l.slice(11)}`;
}

function inicioDoDiaBr(agora: Date): Date {
  const br = new Date(agora.getTime() + FUSO_BR * 3600_000);
  return new Date(
    Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) -
      FUSO_BR * 3600_000
  );
}

/**
 * Resolve o período a partir dos parâmetros da URL.
 *
 * `de`/`ate` (horário de Brasília) vencem o preset — assim o link de uma
 * campanha pode fixar a janela exata dela e continuar valendo quando alguém
 * abrir amanhã.
 */
export function resolverPeriodo(
  params: { p?: string; de?: string; ate?: string },
  agora = new Date()
): Periodo {
  const deManual = params.de ? deLocalParaUtc(params.de) : null;
  const ateManual = params.ate ? deLocalParaUtc(params.ate) : null;

  if (deManual) {
    const ate = ateManual ?? agora.toISOString();
    return {
      de: deManual,
      ate,
      rotulo: `${dataHoraBr(deManual)} → ${dataHoraBr(ate)}`,
    };
  }

  const preset: Preset = ehPreset(params.p) ? params.p : 'hoje';
  const fim = agora.toISOString();

  const desde = (ms: number) => new Date(agora.getTime() - ms).toISOString();

  switch (preset) {
    case 'agora':
      return { de: desde(3600_000), ate: fim, rotulo: 'Última hora' };
    case '24h':
      return { de: desde(86_400_000), ate: fim, rotulo: 'Últimas 24 horas' };
    case '7d':
      return { de: desde(7 * 86_400_000), ate: fim, rotulo: 'Últimos 7 dias' };
    case '30d':
      return { de: desde(30 * 86_400_000), ate: fim, rotulo: 'Últimos 30 dias' };
    case 'tudo':
      return { de: '1970-01-01T00:00:00.000Z', ate: fim, rotulo: 'Desde o início' };
    case 'hoje':
    default:
      return {
        de: inicioDoDiaBr(agora).toISOString(),
        ate: fim,
        rotulo: 'Hoje',
      };
  }
}

/**
 * Em quantos minutos agrupar a série temporal.
 *
 * Uma janela de 40 minutos precisa de barra por minuto; 30 dias precisa de
 * barra por dia. Sem isso o gráfico ou vira uma linha reta (poucos baldes) ou
 * vira 43 mil barras de um pixel.
 */
export function granularidade(p: Periodo): { minutos: number; rotulo: string } {
  const horas = (new Date(p.ate).getTime() - new Date(p.de).getTime()) / 3600_000;
  if (horas <= 3) return { minutos: 5, rotulo: 'a cada 5 min' };
  if (horas <= 12) return { minutos: 15, rotulo: 'a cada 15 min' };
  if (horas <= 48) return { minutos: 60, rotulo: 'por hora' };
  if (horas <= 24 * 14) return { minutos: 360, rotulo: 'a cada 6 h' };
  return { minutos: 1440, rotulo: 'por dia' };
}
