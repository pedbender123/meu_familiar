import db from '../lib/db';
import { produtoDe, ehProdutoValido } from '../lib/produtos';
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

/**
 * Os direitos que vêm dos pedidos **antigos** — o modelo de compra avulsa que
 * existia antes de assinatura existir.
 *
 * Enquanto a escrita dupla da Fase 2 não estiver ligada (e mesmo depois, para
 * todo pedido pago ANTES dela ligar), `assinaturas` está vazia para quase
 * todo mundo. Ler só ela deixaria cliente pagante trancado do lado de fora —
 * exatamente o erro que a disciplina 4 manda evitar.
 *
 * Isto honra a promessa escrita em `produtos.ts`: *"ninguém perde o que
 * pagou"*. Some sozinho quando toda compra virar assinatura de verdade.
 */
function direitosLegados(email: string): Direitos[] {
  const pagos = db
    .prepare(
      `SELECT produto FROM pedidos
       WHERE lower(email) = ? AND status NOT IN ('aguardando_pagamento', 'cancelado')`
    )
    .all(email.trim().toLowerCase()) as { produto: string }[];

  return pagos.filter((p) => ehProdutoValido(p.produto)).map((p) => {
    const produto = produtoDe(p.produto);
    return {
      pdf: produto.pdf,
      imagens: produto.imagens,
      relatorioCompleto: produto.relatorioCompleto,
      graficos: produto.graficos,
      perfilPublico: produto.perfilPublico,
      tiragemDiaria: produto.tiragemDiaria,
      perguntasOraculo: produto.perguntasOraculo,
      narracaoAudio: produto.narracaoAudio,
    };
  });
}

/**
 * O que a plataforma usa de verdade para decidir o que mostrar: a união das
 * assinaturas novas **com** o que a pessoa já comprou no modelo antigo.
 *
 * É este que a casca (menu, telas da conta) chama — nunca `direitosDaConta`
 * sozinho, que enxerga só metade da verdade enquanto a migração não terminou.
 */
export function direitosEfetivos(
  contaId: string,
  email: string,
  agora = new Date()
): Direitos {
  const todos = [direitosDaConta(contaId, agora), ...direitosLegados(email)];
  return unirDireitos(todos);
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
