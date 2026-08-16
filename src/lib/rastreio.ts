/**
 * De onde a pessoa veio — e, o que é diferente, **se aquilo conta**.
 *
 * ── O erro que este arquivo existe para consertar ─────────────────────────
 *
 * Uma venda caiu como origem `outro`. Ela podia ter vindo de qualquer coisa:
 * indicação, busca, alguém que digitou o endereço, ou um dos três vídeos que
 * estavam no ar ao mesmo tempo — e não havia como saber qual. Pior: se a
 * pessoa comprou pelo Instagram e depois voltou pelo link do e-mail, o
 * segundo acesso sobrescrevia o primeiro e o Instagram perdia a venda que
 * tinha trazido.
 *
 * Três decisões resolvem isso:
 *
 *  1. **A URL carrega peça, não só canal.** `?c=ig01` diz campanha `ig`,
 *     peça `01`. Dois vídeos da mesma campanha deixam de virar um número só.
 *  2. **Nem todo toque é aquisição.** O link do e-mail de login é alguém
 *     VOLTANDO ao que já comprou. Ele é gravado (a jornada precisa dele) com
 *     `contaAquisicao: false`, e não rouba o crédito de quem trouxe.
 *  3. **Primeiro toque vence, com uma exceção nomeada.** Remarketing existe
 *     justamente para reconquistar quem foi embora — quando ele fecha venda,
 *     o crédito é dele. É a única coisa que sobrescreve.
 *
 * ── Por que os códigos são curtos ─────────────────────────────────────────
 *
 * Dois caracteres para a campanha, dois para a peça. O link vai em bio de
 * rede social, em legenda de vídeo e em conversa de WhatsApp — lugares onde
 * URL longa é cortada, encurtada por terceiro (perdendo o parâmetro) ou
 * digitada errada. `bruxario.com.br/?c=ig01` cabe falado em voz alta.
 */

/** O que trouxe a pessoa desta vez. */
export type TipoDeToque =
  | 'campanha'
  | 'social'
  | 'compartilhamento'
  | 'remarketing'
  | 'email'
  | 'direto';

export interface Toque {
  tipo: TipoDeToque;
  /** Canal legível: instagram, tiktok… Nulo quando não dá para saber. */
  origem: string | null;
  /** Código da campanha na URL, ainda não resolvido contra o banco. */
  codigoCampanha: string | null;
  /** Código da peça dentro da campanha. */
  codigoPeca: string | null;
  /** Código curto de quem compartilhou, quando veio de link de cliente. */
  codigoIndicacao: string | null;
  /**
   * Se este toque pode ser creditado como AQUISIÇÃO.
   *
   * Falso para e-mail transacional: quem clica no link de login já é cliente,
   * e contar isso como canal criaria um "canal e-mail" que parece trazer
   * gente e não traz ninguém novo.
   */
  contaAquisicao: boolean;
}

/**
 * Os canais que o sistema reconhece pelo nome.
 *
 * Vale para o link da bio (`?de=instagram`), que continua existindo e não vai
 * ser trocado: ele já está publicado em lugares que não dá para editar.
 */
export const ORIGENS_CONHECIDAS = [
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'threads',
  'whatsapp',
  'bio',
  'stories',
  'anuncio',
  'amigo',
  'email',
  'remarketing',
  'compartilhamento',
  'busca',
  'direto',
  'outro',
] as const;

/**
 * Marcadores de e-mail. **Só `rm` conta como aquisição.**
 *
 * Os outros são a pessoa voltando a algo que já é dela — e é exatamente por
 * confundir isso que o painel mostrava canais inflados.
 */
export const MARCAS_DE_EMAIL: Record<string, { rotulo: string; conta: boolean }> = {
  lg: { rotulo: 'Link de acesso', conta: false },
  cf: { rotulo: 'Compra confirmada', conta: false },
  rv: { rotulo: 'Revelação pronta', conta: false },
  rt: { rotulo: 'Resgate do ritual', conta: false },
  ca: { rotulo: 'Lembrete de carrinho', conta: true },
  rs: { rotulo: 'Lembrete de rascunho', conta: true },
  rm: { rotulo: 'Remarketing', conta: true },
};

/**
 * Hosts de rede social, para reconhecer quem chega sem parâmetro nenhum.
 *
 * A Meta usa uma dúzia de subdomínios diferentes pra redirecionar clique de
 * anúncio (varia por posicionamento: feed, Reels, Stories, Audience Network)
 * — só cobrir `facebook`/`lm.facebook`/`l.instagram` deixava `m.facebook`,
 * `an.facebook`, `l.facebook` puro e `fb.watch` caindo em `outro`. O mesmo
 * problema existe pra qualquer rede que não estava na lista original.
 */
const REDES: Record<string, string> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  'fb.watch': 'facebook',
  'fb.com': 'facebook',
  youtube: 'youtube',
  'youtu.be': 'youtube',
  threads: 'threads',
  whatsapp: 'whatsapp',
  telegram: 'telegram',
  't.me': 'telegram',
  pinterest: 'pinterest',
  twitter: 'twitter',
  'x.com': 'twitter',
  linkedin: 'linkedin',
  reddit: 'reddit',
  kwai: 'kwai',
  snapchat: 'snapchat',
  // Encurtadores comuns em link de bio/anúncio impresso: o host é o do
  // encurtador, não da rede — mas ainda é melhor que "outro" sem pista.
  'bit.ly': 'link_curto',
  'bitly.': 'link_curto',
  'linktr.ee': 'link_curto',
};

/** Buscadores, que não são "outro" nem "direto" — são um canal próprio. */
const BUSCADORES = ['google.', 'bing.', 'duckduckgo', 'search.brave', 'ecosia'];

/**
 * Só letras e números, minúsculo, no tamanho pedido. Vale para tudo que vem
 * da URL: um código com caractere estranho é ruído ou tentativa, e nos dois
 * casos o certo é descartar em vez de gravar sujeira no banco.
 */
function limpar(valor: string | null | undefined, max: number): string | null {
  if (!valor) return null;
  const limpo = valor.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, max);
  return limpo || null;
}

/**
 * Quebra `ig01` em campanha `ig` + peça `01`.
 *
 * Aceita só a campanha (`?c=ig`) porque nem todo link tem peça: o da bio do
 * perfil aponta para a campanha inteira, e forçar um código de peça ali seria
 * inventar uma origem que não existe.
 */
export function lerCodigoDeCampanha(bruto: string | null | undefined): {
  campanha: string | null;
  peca: string | null;
} {
  const limpo = limpar(bruto, 4);
  if (!limpo || limpo.length < 2) return { campanha: null, peca: null };
  return {
    campanha: limpo.slice(0, 2),
    peca: limpo.length > 2 ? limpo.slice(2) : null,
  };
}

/**
 * Apelidos curtos que plataforma de anúncio manda sozinha.
 *
 * ── O bug que isto conserta ────────────────────────────────────────────────
 *
 * `Farejador.tsx` manda `utm_source` como fallback de `?de=` quando não há
 * marcador nosso na URL. Ads Manager da Meta tem um macro comum,
 * `{{site_source_name}}`, que os anunciantes colam no campo de UTM do
 * anúncio — e ele resolve para `ig`, `fb`, `an` (Audience Network), `msg`
 * (Messenger), não para a palavra inteira. `normalizarOrigem('ig')` caía em
 * `outro` porque `ig` não está em `ORIGENS_CONHECIDAS`, e por causa da ordem
 * de prioridade em `api/visita/route.ts` isso IMPEDIA o referrer (que teria
 * acertado 'instagram') de ser sequer consultado — uma venda vinda de
 * anúncio real do Instagram aparecia como "Outros" no relatório da campanha.
 */
const ALIAS_DE_ORIGEM: Record<string, string> = {
  ig: 'instagram',
  fb: 'facebook',
  an: 'facebook',
  msg: 'facebook',
  tt: 'tiktok',
  yt: 'youtube',
  wa: 'whatsapp',
};

export function normalizarOrigem(bruto: string | null | undefined): string | null {
  const limpo = limpar(bruto, 24);
  if (!limpo) return null;
  if (ALIAS_DE_ORIGEM[limpo]) return ALIAS_DE_ORIGEM[limpo];
  return (ORIGENS_CONHECIDAS as readonly string[]).includes(limpo)
    ? limpo
    : 'outro';
}

/** O canal que o `referer` denuncia, quando não veio parâmetro nenhum. */
export function origemDoReferer(
  referer: string | null | undefined
): string | null {
  if (!referer) return null;
  let host: string;
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return null;
  }
  // O próprio site não é origem: é navegação interna.
  if (host.includes('bruxario')) return null;
  for (const [chave, canal] of Object.entries(REDES)) {
    if (host.includes(chave)) return canal;
  }
  if (BUSCADORES.some((b) => host.includes(b))) return 'busca';
  return 'outro';
}

/**
 * Lê uma chegada e devolve o que ela é.
 *
 * A ordem das checagens é a ordem de precedência, e ela importa: um link de
 * remarketing que também carregue `?c=` é remarketing, porque o e-mail é o
 * que efetivamente trouxe a pessoa de volta naquele clique.
 */
export function lerToque(params: {
  c?: string | null;
  s?: string | null;
  e?: string | null;
  de?: string | null;
  referer?: string | null;
}): Toque {
  const marca = limpar(params.e, 2);
  if (marca && MARCAS_DE_EMAIL[marca]) {
    const { conta } = MARCAS_DE_EMAIL[marca];
    return {
      tipo: marca === 'rm' ? 'remarketing' : 'email',
      origem: marca === 'rm' ? 'remarketing' : 'email',
      codigoCampanha: null,
      codigoPeca: null,
      codigoIndicacao: null,
      contaAquisicao: conta,
    };
  }

  const indicacao = limpar(params.s, 8);
  if (indicacao) {
    return {
      tipo: 'compartilhamento',
      origem: 'compartilhamento',
      codigoCampanha: null,
      codigoPeca: null,
      codigoIndicacao: indicacao,
      contaAquisicao: true,
    };
  }

  const { campanha, peca } = lerCodigoDeCampanha(params.c);
  if (campanha) {
    return {
      tipo: 'campanha',
      // A origem real sai da campanha no banco (ela sabe a plataforma). Aqui
      // fica nula de propósito: chutar pelo prefixo do código daria errado no
      // dia em que uma campanha do TikTok tiver código que começa com "ig".
      origem: null,
      codigoCampanha: campanha,
      codigoPeca: peca,
      codigoIndicacao: null,
      contaAquisicao: true,
    };
  }

  const declarada = normalizarOrigem(params.de);
  if (declarada) {
    return {
      tipo: 'social',
      origem: declarada,
      codigoCampanha: null,
      codigoPeca: null,
      codigoIndicacao: null,
      contaAquisicao: true,
    };
  }

  const doReferer = origemDoReferer(params.referer ?? null);
  if (doReferer) {
    return {
      tipo: 'social',
      origem: doReferer,
      codigoCampanha: null,
      codigoPeca: null,
      codigoIndicacao: null,
      contaAquisicao: true,
    };
  }

  /**
   * Ninguém sabe. E isso é **informação**, não falha.
   *
   * `direto` quer dizer: digitou o endereço, veio de um app que não manda
   * referer, ou clicou num link que alguém copiou e colou. Antes tudo isso
   * caía em `outro` junto com o tráfego mal marcado, e as duas coisas ficavam
   * indistinguíveis — que é como uma venda de anúncio vira "outro".
   */
  return {
    tipo: 'direto',
    origem: 'direto',
    codigoCampanha: null,
    codigoPeca: null,
    codigoIndicacao: null,
    contaAquisicao: true,
  };
}

/**
 * O cookie de atribuição, compacto.
 *
 * Formato `tipo|origem|campanha|peca|indicacao`, campos vazios quando não se
 * aplicam. É lido a cada criação de pedido, então precisa caber num cookie e
 * ser barato de quebrar — JSON aqui seria escapar aspas em toda requisição
 * para guardar cinco strings curtas.
 */
export const COOKIE_ATRIBUICAO = 'bx_at';

export interface Atribuicao {
  tipo: TipoDeToque;
  origem: string | null;
  campanhaId: string | null;
  pecaId: string | null;
  indicadoPor: string | null;
}

export function serializarAtribuicao(a: Atribuicao): string {
  return [a.tipo, a.origem ?? '', a.campanhaId ?? '', a.pecaId ?? '', a.indicadoPor ?? '']
    .map((v) => v.replace(/\|/g, ''))
    .join('|');
}

export function lerAtribuicao(bruto: string | null | undefined): Atribuicao | null {
  if (!bruto) return null;
  const [tipo, origem, campanhaId, pecaId, indicadoPor] = bruto.split('|');
  if (!tipo) return null;
  return {
    tipo: tipo as TipoDeToque,
    origem: origem || null,
    campanhaId: campanhaId || null,
    pecaId: pecaId || null,
    indicadoPor: indicadoPor || null,
  };
}

/**
 * Decide se o toque novo substitui a atribuição já guardada.
 *
 * **Primeiro toque vence, e remarketing é a única exceção.**
 *
 * O primeiro toque é quem descobriu a pessoa — trocar por um toque posterior
 * credita a venda ao último clique, que é quase sempre o e-mail ou o acesso
 * direto de quem já conhecia o site. Isso faz o canal que realmente traz
 * gente parecer improdutivo, e é o erro que estava acontecendo.
 *
 * Remarketing é diferente por natureza: aquele e-mail só é disparado para
 * quem JÁ tinha ido embora. Se a venda acontece depois dele, foi ele. Manter
 * o crédito no anúncio original ali seria premiar quem já tinha perdido.
 */
export function deveSubstituir(
  atual: Atribuicao | null,
  novo: Toque
): boolean {
  if (!novo.contaAquisicao) return false;
  if (!atual) return true;
  if (novo.tipo === 'remarketing') return true;
  /**
   * `direto` não sobrescreve nada, nem outro `direto`: quem chegou sem
   * marcação e depois voltou com marcação de verdade deve ser creditado à
   * marcação. O inverso — perder a campanha porque a pessoa digitou o
   * endereço no dia seguinte — é justamente o vazamento que virava `outro`.
   */
  if (atual.tipo === 'direto' && novo.tipo !== 'direto') return true;
  return false;
}

/**
 * A atribuição de um pedido, lida dos cookies que o rastreio deixou.
 *
 * Cai para `bx_de` quando `bx_at` não existe: quem já estava navegando quando
 * o rastreio novo subiu tem o cookie antigo e mais nada, e perder a origem
 * dessas pessoas seria reescrever a história para pior.
 */
export function atribuicaoDoPedido(cookies: {
  get(nome: string): { value: string } | undefined;
}): {
  origem: string | null;
  campanha_id: string | null;
  peca_id: string | null;
  atribuicao: string;
  indicado_por: string | null;
} {
  const a = lerAtribuicao(cookies.get(COOKIE_ATRIBUICAO)?.value);
  if (a) {
    return {
      origem: a.origem,
      campanha_id: a.campanhaId,
      peca_id: a.pecaId,
      // O tipo do toque É a explicação do crédito: 'campanha' quer dizer
      // primeiro toque de anúncio, 'remarketing' quer dizer reconquista.
      atribuicao: a.tipo,
      indicado_por: a.indicadoPor,
    };
  }
  return {
    origem: normalizarOrigem(cookies.get('bx_de')?.value),
    campanha_id: null,
    peca_id: null,
    atribuicao: 'legado',
    indicado_por: null,
  };
}
