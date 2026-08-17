/**
 * Quando a cota volta — em texto que a pessoa entende.
 *
 * A janela está na chave (`2026-08-17`, `2026-08`), então o "reset" não é um
 * evento agendado: é a virada da data. Isso é ótimo pro sistema (nada precisa
 * rodar) e péssimo pra tela, que precisa dizer *quando* — daí esta tradução.
 */
export interface QuandoVolta {
  /** ISO do instante em que a janela vira. */
  em: string;
  /** "em 3 horas", "amanhã", "em 12 dias" — o que a tela mostra. */
  texto: string;
}

const UM_MINUTO = 60_000;
const UMA_HORA = 3_600_000;
const UM_DIA = 86_400_000;

function humanizar(ms: number): string {
  if (ms <= 0) return 'agora';
  if (ms < UMA_HORA) {
    const minutos = Math.max(1, Math.round(ms / UM_MINUTO));
    return minutos === 1 ? 'em 1 minuto' : `em ${minutos} minutos`;
  }
  if (ms < UM_DIA) {
    const horas = Math.round(ms / UMA_HORA);
    return horas === 1 ? 'em 1 hora' : `em ${horas} horas`;
  }
  const dias = Math.round(ms / UM_DIA);
  return dias === 1 ? 'amanhã' : `em ${dias} dias`;
}

/** A virada do dia — meia-noite local. */
export function voltaDoDia(agora = new Date()): QuandoVolta {
  const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  return {
    em: amanha.toISOString(),
    texto: humanizar(amanha.getTime() - agora.getTime()),
  };
}

/** A virada do mês — dia 1º às 00:00. */
export function voltaDoMes(agora = new Date()): QuandoVolta {
  const proximo = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
  return {
    em: proximo.toISOString(),
    texto: humanizar(proximo.getTime() - agora.getTime()),
  };
}
