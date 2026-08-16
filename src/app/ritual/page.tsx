import { Suspense } from 'react';
import { ITENS } from '@/lib/quiz/itens';
import { PRODUTO_PADRAO } from '@/lib/produtos';
import { RitualCliente } from './RitualCliente';

/**
 * Renderizado a cada visita, e não em build: a ordem das opções é sorteada
 * aqui, então precisa mudar de pessoa para pessoa.
 */
export const dynamic = 'force-dynamic';

/**
 * Server component fino: entrega os itens do banco para o cliente.
 *
 * Assim as cenas vêm de `lib/quiz/itens.ts`, o mesmo arquivo que o motor de
 * pontuação lê. A versão anterior tinha as perguntas escritas à mão dentro do
 * componente de tela, divergindo do resto do código — mudar um item exigia
 * lembrar de mudar em dois lugares, e ninguém lembra.
 */
/**
 * Embaralha a ordem de exibição das opções (SPEC 2.6, efeito de ordem).
 *
 * Devolve os índices ORIGINAIS numa ordem nova — a resposta que volta para o
 * servidor continua sendo o índice do item, não a posição na tela.
 */
function ordemEmbaralhada(): Record<string, number[]> {
  const mapa: Record<string, number[]> = {};
  for (const item of ITENS) {
    const indices = item.opcoes.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    mapa[item.id] = indices;
  }
  return mapa;
}

export default function Ritual() {
  return (
    // Suspense porque o ritual lê `?r=` (a cena respondida na landing) com
    // useSearchParams — sem a fronteira, o Next recusa o build.
    <Suspense fallback={null}>
      <RitualCliente
        itens={ITENS}
        ordemDasOpcoes={ordemEmbaralhada()}
        produtoPadrao={PRODUTO_PADRAO}
      />
    </Suspense>
  );
}
