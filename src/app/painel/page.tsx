import { redirect } from 'next/navigation';

/**
 * A raiz do painel não tem tela própria.
 *
 * O painel antigo vivia aqui: uma página só, com pedidos, cupons, contatos e
 * comentários empilhados, e links no topo para as outras. Virou a área
 * administrativa com barra lateral — cada assunto tem o seu lugar e a
 * navegação está sempre à mão, sem precisar voltar por aqui.
 *
 * A Central é a porta certa: é a única que responde "e agora?".
 */
export default function Painel() {
  redirect('/painel/central');
}
