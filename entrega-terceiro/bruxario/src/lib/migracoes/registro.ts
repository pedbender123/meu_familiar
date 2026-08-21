import type { Migracao } from './tipos';
import m001 from './001_base';
import m002 from './002_interruptores';
import m003 from './003_anomalias';
import m004 from './004_fila_capi';

/**
 * A ordem de execução. Só se acrescenta ao fim — nunca reordena, nunca edita
 * uma migração já aplicada em produção. Uma migração errada se corrige com
 * uma migração nova que desfaz o efeito, não editando a antiga.
 *
 * A numeração salta de 004 para o que vier: as de 005 a 024 pertenciam à
 * plataforma de assinatura, que não existe nesta versão. Os números não são
 * reaproveitados de propósito — um banco que já rodou a antiga 007 não pode
 * receber uma nova com o mesmo id e pular a execução em silêncio.
 */
export const MIGRACOES: Migracao[] = [m001, m002, m003, m004];
