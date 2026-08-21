import type { Migracao } from './tipos';
import m001 from './001_base';

/**
 * A ordem de execução. Só se acrescenta ao fim — nunca reordena, nunca edita
 * uma migração já aplicada em produção. Uma migração errada se corrige com
 * uma migração nova que desfaz o efeito, não editando a antiga.
 */
export const MIGRACOES: Migracao[] = [m001];
