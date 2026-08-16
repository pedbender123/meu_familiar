import { checarEmLinha } from './sentinela/emLinha';
import { direitosDaConta } from './acesso';
import { buscarAssinaturaDoPedido } from './assinaturas';
import type { Direitos } from './direitos';

/**
 * Compara o que `produtos.ts` diz (a lógica atual, em produção) com o que o
 * núcleo novo diria (`acesso.ts`), e registra divergência sem decidir nada —
 * Fase 2, modo sombra (docs/reestruturacao.md, disciplina 4).
 *
 * Só compara quando já existe assinatura para este pedido: sem isso, TODA
 * conta divergiria enquanto a escrita dupla estiver desligada (ou recém
 * ligada e ainda não alcançou pedidos antigos) — seria ruído, não sinal.
 * Silêncio aqui não significa "bateu", significa "ainda não dá pra comparar".
 */
export function compararAcessoEmSombra(
  contaId: string,
  pedidoId: string,
  direitoAntigo: Partial<Direitos>
): void {
  checarEmLinha('sombra_acesso', () => {
    const assinatura = buscarAssinaturaDoPedido(pedidoId);
    if (!assinatura) return null;

    const novo = direitosDaConta(contaId);
    const chaves = Object.keys(direitoAntigo) as (keyof Direitos)[];
    const divergencias = chaves.filter(
      (chave) => direitoAntigo[chave] !== undefined && direitoAntigo[chave] !== novo[chave]
    );

    if (divergencias.length === 0) return null;

    return {
      invariante: 'nucleo_acesso_diverge_do_produto',
      severidade: 'medio',
      entidadeTipo: 'conta',
      entidadeId: contaId,
      esperado: JSON.stringify(
        Object.fromEntries(divergencias.map((c) => [c, direitoAntigo[c]]))
      ),
      encontrado: JSON.stringify(Object.fromEntries(divergencias.map((c) => [c, novo[c]]))),
      contexto: { pedidoId },
    };
  });
}
