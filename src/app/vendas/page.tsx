import { PortaDoRitual } from '@/app/PortaDoRitual';

export const metadata = {
  title: 'Descubra seu familiar — Bruxário',
  description:
    'Descubra qual dos 12 animais guarda a sua natureza. Não é signo.',
};

export const dynamic = 'force-dynamic';

/**
 * A página de vendas — **as 26 cenas, e nada na frente delas.**
 *
 * ── O que ela era, e o que ela é ──────────────────────────────────────────
 *
 * Ela já foi a porta do funil de sete perguntas: três perguntas, uma revelação
 * por grupo, o preço antes do teste de verdade. Era uma aposta de que dá para
 * vender com menos atrito, e a aposta perdeu — quem vende é o teste inteiro.
 *
 * O endereço fica, o conteúdo troca. É o endereço que está nos criativos, nos
 * links já publicados e na cabeça de quem toca as campanhas; mudá-lo custaria
 * um retrabalho na agência para não ganhar nada.
 *
 * ── Por que não é um redirecionamento para `/` ────────────────────────────
 *
 * Porque a raiz sem marcador é a **landing explicativa** — os doze familiares,
 * o método, a tabela de planos. Ela existe para quem digitou o endereço, foi
 * indicado ou já é cliente, e é exatamente o material que não pode aparecer
 * na frente de tráfego frio: dá ao cérebro tudo o que ele precisa para
 * calcular o que vem no fim antes de chegar lá, e quem calcula fecha a aba.
 *
 * Mandar `/vendas` para `/` entregava a landing a quem clicou num anúncio.
 * Aqui a primeira cena É a página, com marcador ou sem.
 *
 * ── E por que não é `/ritual` ─────────────────────────────────────────────
 *
 * `/ritual` são as mesmas 26 cenas para quem já passou pela landing e clicou
 * "começar" — pessoa que já leu a promessa e não precisa dela de novo.
 * `PortaDoRitual` é a versão para quem chega do anúncio: leva o título que
 * segura a promessa até a primeira resposta, e o rodapé mínimo com o aviso de
 * retrato simbólico e os termos, que são exigência para rodar anúncio.
 */
export default function Vendas() {
  return <PortaDoRitual />;
}
