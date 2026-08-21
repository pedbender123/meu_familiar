import { PortaDoRitual } from './PortaDoRitual';

export const dynamic = 'force-dynamic';

/**
 * A porta de entrada: **as 26 cenas, direto.**
 *
 * Não há landing explicativa na frente. Ela existia, e o que se aprendeu foi
 * que ela custa venda: os doze familiares, o método e o preço dão ao cérebro
 * tudo de que ele precisa para calcular o que vem no fim ANTES de chegar lá,
 * e quem calcula fecha a aba.
 *
 * Quem chega aqui vindo de um anúncio já está curioso. A curiosidade é o
 * combustível e é frágil — então a primeira coisa na tela é a primeira
 * pergunta, e a venda acontece no fim, quando a pessoa já respondeu e já viu
 * o resultado.
 */
export default function Raiz() {
  return <PortaDoRitual />;
}
