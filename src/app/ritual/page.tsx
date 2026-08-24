import { Suspense } from 'react';
import { ordemEmbaralhada, itensNaOrdemDeExibicao } from '@/lib/quiz/ordem';
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
 *
 * Esta rota é a porta de quem veio da landing e clicou "começar o ritual".
 * Quem chega por campanha cai nas mesmas cenas pela raiz, sem landing nenhuma
 * antes — ver `PortaDoRitual` em `src/app/PortaDoRitual.tsx`.
 */
export default function Ritual() {
  return (
    // Suspense porque o ritual lê `?r=` (a cena respondida na landing) com
    // useSearchParams — sem a fronteira, o Next recusa o build.
    <Suspense fallback={null}>
      <RitualCliente
        itens={itensNaOrdemDeExibicao()}
        ordemDasOpcoes={ordemEmbaralhada()}
        produtoPadrao={PRODUTO_PADRAO}
      />
    </Suspense>
  );
}
