import type { Migracao } from './tipos';
import m001 from './001_base';
import m002 from './002_interruptores';
import m003 from './003_anomalias';
import m004 from './004_fila_capi';
import m005 from './005_nucleo_assinaturas';
import m006 from './006_contas_checkout';

/**
 * A ordem de execução. Só se acrescenta ao fim — nunca reordena, nunca edita
 * uma migração já aplicada em produção. Uma migração errada se corrige com
 * uma migração nova que desfaz o efeito, não editando a antiga.
 */
export const MIGRACOES: Migracao[] = [m001, m002, m003, m004, m005, m006];
