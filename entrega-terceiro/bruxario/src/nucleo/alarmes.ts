import { pedidosTravados } from '../lib/db';
import { emailDoAdmin } from '../lib/autenticacao';
import { enviarResumoDeAlarmes } from '../lib/email';
import { anomaliasAbertas } from './sentinela/registrar';
import { resumoDaFilaCapi } from '../lib/fila-capi';

export interface EstadoDosAlarmes {
  criticas: number;
  altas: number;
  pedidosTravados: number;
  capiFalhouDefinitivo: number;
  precisaAvisar: boolean;
}

/** Só junta os números — não manda e-mail, não decide cadência. Testável sem rede. */
export function estadoDosAlarmes(): EstadoDosAlarmes {
  const criticas = anomaliasAbertas('critico');
  const altas = anomaliasAbertas('alto');
  const travados = pedidosTravados().length;
  const { falharamDefinitivo } = resumoDaFilaCapi();

  return {
    criticas: criticas.length,
    altas: altas.length,
    pedidosTravados: travados,
    capiFalhouDefinitivo: falharamDefinitivo,
    precisaAvisar: criticas.length > 0 || altas.length > 0 || travados > 0 || falharamDefinitivo > 0,
  };
}

/**
 * Verifica e, se houver algo, manda o resumo pro admin.
 *
 * Pensado para cron (a cada hora, por exemplo — ver docs/reestruturacao.md,
 * Fase 1). **Sem cooldown embutido**: cada rodada com algo aberto manda
 * e-mail de novo, de propósito nesta primeira versão — o jeito de parar de
 * receber é resolver a anomalia (`resolverAnomalia`) ou consertar o que
 * travou, não o alarme cansar de avisar sozinho. Cadência de cron moderada
 * (não a cada minuto) é o que evita spam por ora; um cooldown de verdade
 * fica para quando a Fase 1 tiver o painel de alarmes para configurá-lo.
 */
export async function verificarEAvisar(): Promise<{ avisou: boolean; estado: EstadoDosAlarmes }> {
  const estado = estadoDosAlarmes();
  if (!estado.precisaAvisar) return { avisou: false, estado };

  const destino = emailDoAdmin();
  if (!destino) {
    console.warn('[alarmes] há algo pra avisar, mas ADMIN_EMAIL não está configurado');
    return { avisou: false, estado };
  }

  await enviarResumoDeAlarmes({
    destino,
    anomaliasCriticas: anomaliasAbertas('critico').map((a) => ({
      entidadeTipo: a.entidadeTipo,
      entidadeId: a.entidadeId,
      esperado: a.esperado,
      encontrado: a.encontrado,
    })),
    anomaliasAltas: anomaliasAbertas('alto').map((a) => ({
      entidadeTipo: a.entidadeTipo,
      entidadeId: a.entidadeId,
      esperado: a.esperado,
      encontrado: a.encontrado,
    })),
    pedidosTravados: estado.pedidosTravados,
    capiFalhouDefinitivo: estado.capiFalhouDefinitivo,
  });

  return { avisou: true, estado };
}
