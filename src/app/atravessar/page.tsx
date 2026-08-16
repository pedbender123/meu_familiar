import { FunilDeVendas } from './FunilDeVendas';
import { ISCA } from '@/lib/quiz/isca';

export const metadata = {
  title: 'Descubra seu familiar — Bruxário',
  robots: { index: false, follow: false },
};

/**
 * O funil de anúncio, em rota própria.
 *
 * Separado de `/ritual` de propósito. Aquela rota é o teste de verdade — 26
 * cenas, quatro eixos — e continua servindo quem chega pela landing `/`,
 * exatamente como antes. Esta serve o tráfego pago, que precisa de outra
 * coisa: chegar ao preço enquanto ainda está curioso.
 *
 * Ter as duas na mesma rota foi um erro que já custou o caminho da landing:
 * mudar o funil de anúncio quebrava o teste, e vice-versa.
 *
 * ── O `?r=` ───────────────────────────────────────────────────────────────
 *
 * Quem responde a primeira pergunta ainda em `/vendas` chega aqui com a
 * escolha na URL (`?r=i1:2`). Sem consumi-la, a pessoa responderia a mesma
 * pergunta duas vezes — o pior primeiro segundo possível, porque parece que o
 * site perdeu o clique dela.
 *
 * É lido no servidor e passado como prop em vez de `useSearchParams` no
 * cliente: aquele exige um limite de Suspense e faria a página inteira
 * renderizar duas vezes por causa de um número.
 */
export default async function Atravessar({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  return <FunilDeVendas respostaInicial={lerResposta(r)} />;
}

/**
 * Traduz `?r=i1:2` numa resposta válida — ou `null`.
 *
 * Valida contra a isca em vez de confiar no formato: a URL é editável por
 * qualquer um, e um índice fora da faixa viraria `undefined` na hora de
 * contar os votos.
 */
function lerResposta(r: string | undefined): Record<string, number> | null {
  if (!r) return null;
  const [id, bruto] = r.split(':');
  const pergunta = ISCA.find((p) => p.id === id);
  const indice = Number(bruto);
  if (!pergunta || !Number.isInteger(indice)) return null;
  if (indice < 0 || indice >= pergunta.opcoes.length) return null;
  return { [id]: indice };
}
