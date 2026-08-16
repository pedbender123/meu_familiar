import { assinaturasAtivasDaConta } from './assinaturas';
import { buscarPlano, direitosDoPlano } from './planos';
import { unirDireitos, SEM_DIREITOS, type Direitos } from './direitos';

/**
 * O portão único (docs/reestruturacao.md, Fase 2). Responde pela **união dos
 * direitos das assinaturas ativas** da conta — não pelo último pedido.
 */
export function direitosDaConta(contaId: string, agora = new Date()): Direitos {
  const ativas = assinaturasAtivasDaConta(contaId, agora);
  if (ativas.length === 0) return SEM_DIREITOS;

  const direitos = ativas
    .map((a) => buscarPlano(a.plano_id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map(direitosDoPlano);

  return unirDireitos(direitos);
}

/** Direito booleano — `pdf`, `graficos`, `perfilPublico`, etc. */
export function podeAcessar(
  contaId: string,
  direito: Exclude<keyof Direitos, 'perguntasOraculo'>,
  agora = new Date()
): boolean {
  return direitosDaConta(contaId, agora)[direito] === true;
}

/** Direito numérico — hoje só `perguntasOraculo`. Cota de consumo de verdade (dia/mês) é Fase 8/9. */
export function cotaDe(contaId: string, direito: 'perguntasOraculo', agora = new Date()): number {
  return direitosDaConta(contaId, agora)[direito];
}
