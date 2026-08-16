/**
 * Os funis de venda do familiar, e quem decide qual a pessoa vê.
 *
 * ── Por que um registro em vez de rotas soltas ────────────────────────────
 *
 * Cada funil é uma aposta sobre o que faz alguém comprar, e a única forma de
 * saber qual ganha é rodar os dois com o mesmo tráfego e comparar venda com
 * venda. Isso exige três coisas que rota solta não dá: um código estável para
 * cada um, um sorteio que grude na pessoa (senão ela troca de funil ao
 * recarregar e o dado vira ruído), e o código gravado no pedido.
 *
 * ── Um endereço só ────────────────────────────────────────────────────────
 *
 * Todo link publicado é `bruxario.com.br`, com ou sem `?c=`. Quem decide o
 * que aparece ali é a CAMPANHA, não o caminho — antes existia uma rota por
 * funil (`/atravessar`, `/familiar`) e um `?f=` para forçar, o que obrigava a
 * trocar o link do anúncio para trocar de teste e enchia o site de endereços
 * que diziam a mesma coisa.
 *
 * ── Quem digita o endereço vê a landing ───────────────────────────────────
 *
 * Sem marcação nenhuma, `/` é a landing expositiva com as 26 cenas atrás
 * dela. Quem chegou por indicação, ou volta depois de comprar, não entra em
 * teste — e a landing é a página que responde as perguntas dessa pessoa.
 */

export type FunilId = 'padrao' | 'atravessar' | 'familiar';

export interface Funil {
  id: FunilId;
  /** Duas letras, para o relatório. */
  codigo: string;
  /** Onde o funil é renderizado internamente. Não é link publicado. */
  caminho: string;
  nome: string;
  /** O que essa aposta afirma — aparece no painel, ao lado do resultado. */
  aposta: string;
  ativo: boolean;
}

export const FUNIS: Record<FunilId, Funil> = {
  /**
   * O das 26 cenas — e **o único que já vendeu**.
   *
   * Ele entrou por último nesta lista e devia ter entrado primeiro: todas as
   * vendas até aqui saíram dele. Os dois de baixo são apostas de que dá para
   * vender com menos atrito; enquanto não provarem isso com venda, este é a
   * referência contra a qual eles são medidos, não o contrário.
   */
  padrao: {
    id: 'padrao',
    codigo: 'pd',
    caminho: '/',
    nome: 'Landing e as 26 cenas',
    aposta:
      'A pessoa lê o que é, decide entrar, e responde o teste inteiro antes de ver preço. Aposta em qualificação: quem atravessa 26 cenas já quer o resultado.',
    ativo: true,
  },
  atravessar: {
    id: 'atravessar',
    codigo: 'at',
    caminho: '/atravessar',
    nome: 'Sete perguntas',
    aposta:
      'Sete perguntas curtas sobre ela, revelação do grupo, e só então o preço. Aposta em curiosidade rápida: chegar ao valor enquanto a pessoa ainda quer saber.',
    ativo: true,
  },
  familiar: {
    id: 'familiar',
    codigo: 'fa',
    caminho: '/familiar',
    nome: 'Ritual longo',
    aposta:
      'Funil comprido no formato validado por quem já vende neste mercado: nascimento com signo ao vivo, leitura do mapa, medidor de energia que sobe, recapitulação. Aposta em investimento acumulado — quem respondeu doze passos larga mais difícil.',
    ativo: true,
  },
};

export const FUNIL_PADRAO: FunilId = 'padrao';

/**
 * Quais funis uma campanha usa é decisão DELA, não uma lista global.
 *
 * Antes existia uma lista fixa de "os que estão em teste" e um `?f=ab` que
 * sorteava entre eles. Isso obrigava a inventar uma URL para cada combinação
 * e não deixava rodar dois testes diferentes ao mesmo tempo. Agora a campanha
 * guarda os seus (ver `campanhas.funis`): uma só = todo mundo vê aquela; mais
 * de uma = teste A/B entre elas, e só entre elas.
 */
export function sortearEntre(candidatos: FunilId[]): FunilId {
  const validos = candidatos.filter((id) => FUNIS[id]?.ativo);
  if (validos.length === 0) return FUNIL_PADRAO;
  return validos[Math.floor(Math.random() * validos.length)];
}

export function ehFunil(v: unknown): v is FunilId {
  return typeof v === 'string' && v in FUNIS;
}

export function funilPorCodigo(codigo: string | null | undefined): Funil | null {
  if (!codigo) return null;
  const limpo = codigo.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
  return Object.values(FUNIS).find((f) => f.codigo === limpo) ?? null;
}

export function funilPorCaminho(caminho: string): Funil | null {
  return Object.values(FUNIS).find((f) => f.caminho === caminho) ?? null;
}

/**
 * O cookie que gruda o funil sorteado na pessoa, só durante uma sessão com
 * marcador (ver a regra em `app/page.tsx`).
 *
 * Sem ele, um recarregamento de página no meio de um teste A/B sortearia de
 * novo — a pessoa começaria num funil, recarregaria e cairia no outro, e o
 * relatório mostraria duas metades de jornada que nunca existiram.
 *
 * ── Por que o nome mudou de `bx_f` para `bx_f2` ───────────────────────────
 *
 * Até aqui, TODA visita gravava este cookie — inclusive `/` puro, sem
 * marcador nenhum. Isso deixava visitante antigo preso no funil da última
 * campanha que ele viu, mesmo digitando o domínio de cabeça meses depois; e
 * podia sequestrar uma campanha nova também. Não dá para alcançar o navegador
 * de quem já visitou e apagar o `bx_f` de lá — mas trocar a chave faz o
 * código parar de ler qualquer cookie antigo: ele fica órfão no navegador da
 * pessoa, inerte, e expira sozinho no prazo que já tinha (`comum.maxAge`, um
 * ano). Efeito prático: todo cookie de funil gravado antes desta mudança para
 * de valer a partir de agora.
 */
export const COOKIE_DO_FUNIL = 'bx_f2';

/**
 * Lê a coluna `funis` da campanha.
 *
 * Guardada como JSON porque é uma lista de tamanho variável e o SQLite não
 * tem array. Vazia, inválida ou ausente cai no padrão — uma campanha antiga,
 * criada antes desta coluna existir, continua funcionando como sempre
 * funcionou em vez de servir tela em branco.
 */
export function funisDaCampanha(bruto: string | null | undefined): FunilId[] {
  if (!bruto) return [FUNIL_PADRAO];
  try {
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [FUNIL_PADRAO];
    const validos = lista.filter(ehFunil);
    return validos.length > 0 ? validos : [FUNIL_PADRAO];
  } catch {
    return [FUNIL_PADRAO];
  }
}
