import db from './db';
import { precoDoPedido } from './cupons';

/**
 * Métricas de acesso e venda.
 *
 * ── Por que analítica própria e não Google Analytics ──────────────────────
 *
 * Três razões, em ordem de peso:
 *
 * 1. **O que interessa aqui é a junção.** A pergunta do dono não é "quantas
 *    visitas" — é "o TikTok traz gente que compra?". Isso exige cruzar visita
 *    com pedido, e a origem só existe do lado de cá porque é a mesma tabela
 *    que guarda a venda. Ferramenta externa vê o clique e não vê o R$.
 * 2. **Sem script de terceiro, sem banner de cookie.** GA transfere dado para
 *    fora do país e é publicidade — exigiria consentimento explícito e um
 *    banner que atrapalha a primeira impressão de um site que vende clima.
 * 3. **O volume cabe no SQLite.** Alguns milhares de linhas por mês.
 *
 * ── O que NÃO é coletado, de propósito ────────────────────────────────────
 *
 * IP não é gravado na tabela de visitas. Nome, e-mail e nada de identidade
 * encostam aqui. O `visitante` é um número aleatório de cookie primeiro-parte
 * que existe só para separar "20 visitas" de "20 pessoas", não segue ninguém
 * por outros sites, e não alimenta anúncio de ninguém.
 *
 * ── Fuso ──────────────────────────────────────────────────────────────────
 *
 * As datas são gravadas em UTC (ISO) e agrupadas em **horário de Brasília**.
 * Sem o deslocamento, tudo que acontece depois das 21h no Brasil apareceria no
 * dia seguinte — e o gráfico diário mentiria justamente no horário de maior
 * movimento de rede social.
 */

/** Brasília, UTC−3. O país não usa mais horário de verão desde 2019. */
const FUSO = "-3 hours";

/** Um dia em SQL, no fuso certo: 'YYYY-MM-DD'. */
const DIA_LOCAL = `date(criado_em, '${FUSO}')`;

export type Janela = 'hoje' | '7d' | '30d' | '90d' | 'tudo';

export const JANELAS: { id: Janela; rotulo: string; dias: number | null }[] = [
  { id: 'hoje', rotulo: 'Hoje', dias: 0 },
  { id: '7d', rotulo: '7 dias', dias: 7 },
  { id: '30d', rotulo: '30 dias', dias: 30 },
  { id: '90d', rotulo: '90 dias', dias: 90 },
  { id: 'tudo', rotulo: 'Tudo', dias: null },
];

export function ehJanela(v: unknown): v is Janela {
  return typeof v === 'string' && JANELAS.some((j) => j.id === v);
}

/**
 * O corte de data de uma janela, em ISO UTC.
 *
 * "Hoje" é a meia-noite de Brasília, não as últimas 24h: quando você abre o
 * painel às 9h, "hoje" tem que ser o dia que está correndo, e não incluir a
 * noite de ontem — senão o número muda de significado conforme a hora que
 * você olha.
 */
export function desde(janela: Janela, agora = new Date()): string | null {
  if (janela === 'tudo') return null;

  if (janela === 'hoje') {
    const brasilia = new Date(agora.getTime() - 3 * 3600_000);
    const meiaNoiteBrasilia = Date.UTC(
      brasilia.getUTCFullYear(),
      brasilia.getUTCMonth(),
      brasilia.getUTCDate()
    );
    return new Date(meiaNoiteBrasilia + 3 * 3600_000).toISOString();
  }

  const dias = JANELAS.find((j) => j.id === janela)!.dias!;
  return new Date(agora.getTime() - dias * 86_400_000).toISOString();
}

/* ── o resumo ──────────────────────────────────────────────────────────── */

export interface Resumo {
  visitas: number;
  visitantes: number;
  /** Quem chegou a abrir o ritual. */
  rituais: number;
  /** Pedidos criados, pagos ou não. */
  pedidos: number;
  entregues: number;
  receitaCentavos: number;
  /** Entregues ÷ visitantes, em %. */
  conversao: number;
  /** Receita ÷ visitantes, em centavos. Quanto vale uma visita. */
  porVisitante: number;
  ticketMedio: number;
}

function contar(sql: string, corte: string | null): number {
  const onde = corte ? 'WHERE criado_em >= @corte' : '';
  const linha = db
    .prepare(sql.replace('{ONDE}', onde))
    .get({ corte }) as { n: number } | undefined;
  return linha?.n ?? 0;
}

export function resumo(janela: Janela): Resumo {
  const corte = desde(janela);

  const visitas = contar('SELECT count(*) n FROM visitas {ONDE}', corte);
  const visitantes = contar(
    'SELECT count(DISTINCT visitante) n FROM visitas {ONDE}',
    corte
  );
  const rituais = contar(
    `SELECT count(DISTINCT visitante) n FROM visitas
      WHERE caminho LIKE '/ritual%' ${corte ? 'AND criado_em >= @corte' : ''}`,
    corte
  );

  // `exemplo = 0` em tudo que conta venda: as amostras do mural somos nós, e
  // contá-las como pedido infla conversão e receita ao mesmo tempo.
  const pedidos = contar(
    `SELECT count(*) n FROM pedidos
      WHERE exemplo = 0 ${corte ? 'AND criado_em >= @corte' : ''}`,
    corte
  );

  const vendas = db
    .prepare(
      `SELECT produto, desconto_percentual FROM pedidos
        WHERE exemplo = 0 AND status = 'entregue'
        ${corte ? 'AND criado_em >= @corte' : ''}`
    )
    .all({ corte }) as { produto: string; desconto_percentual: number | null }[];

  const receitaCentavos = vendas.reduce(
    (s, p) => s + precoDoPedido(p).finalCentavos,
    0
  );
  const entregues = vendas.length;

  return {
    visitas,
    visitantes,
    rituais,
    pedidos,
    entregues,
    receitaCentavos,
    conversao: visitantes ? (entregues / visitantes) * 100 : 0,
    porVisitante: visitantes ? Math.round(receitaCentavos / visitantes) : 0,
    ticketMedio: entregues ? Math.round(receitaCentavos / entregues) : 0,
  };
}

/* ── séries no tempo ───────────────────────────────────────────────────── */

export interface PontoDoDia {
  dia: string;
  visitantes: number;
  pedidos: number;
  entregues: number;
  receitaCentavos: number;
}

/**
 * A série diária, **com os dias vazios preenchidos**.
 *
 * O SQL só devolve dias que tiveram alguma linha. Desenhar direto o resultado
 * faria um domingo sem visita nenhuma simplesmente não existir no eixo, e a
 * linha ligaria sábado a segunda como se nada tivesse mudado — que é a mentira
 * mais comum em gráfico de série temporal.
 */
export function porDia(dias: number, agora = new Date()): PontoDoDia[] {
  const corte = new Date(agora.getTime() - (dias - 1) * 86_400_000).toISOString();

  const visitas = db
    .prepare(
      `SELECT ${DIA_LOCAL} dia, count(DISTINCT visitante) n
         FROM visitas WHERE criado_em >= ? GROUP BY dia`
    )
    .all(corte) as { dia: string; n: number }[];

  const pedidos = db
    .prepare(
      `SELECT ${DIA_LOCAL} dia, count(*) n
         FROM pedidos WHERE exemplo = 0 AND criado_em >= ? GROUP BY dia`
    )
    .all(corte) as { dia: string; n: number }[];

  const entregues = db
    .prepare(
      `SELECT ${DIA_LOCAL} dia, produto, desconto_percentual
         FROM pedidos
        WHERE exemplo = 0 AND status = 'entregue' AND criado_em >= ?`
    )
    .all(corte) as {
    dia: string;
    produto: string;
    desconto_percentual: number | null;
  }[];

  const mapaVisitas = new Map(visitas.map((v) => [v.dia, v.n]));
  const mapaPedidos = new Map(pedidos.map((p) => [p.dia, p.n]));
  const mapaVendas = new Map<string, { n: number; centavos: number }>();
  for (const e of entregues) {
    const atual = mapaVendas.get(e.dia) ?? { n: 0, centavos: 0 };
    atual.n += 1;
    atual.centavos += precoDoPedido(e).finalCentavos;
    mapaVendas.set(e.dia, atual);
  }

  const serie: PontoDoDia[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(agora.getTime() - i * 86_400_000 - 3 * 3600_000);
    const dia = d.toISOString().slice(0, 10);
    const venda = mapaVendas.get(dia) ?? { n: 0, centavos: 0 };
    serie.push({
      dia,
      visitantes: mapaVisitas.get(dia) ?? 0,
      pedidos: mapaPedidos.get(dia) ?? 0,
      entregues: venda.n,
      receitaCentavos: venda.centavos,
    });
  }
  return serie;
}

/* ── de onde vem ───────────────────────────────────────────────────────── */

export interface LinhaDeOrigem {
  origem: string;
  visitantes: number;
  pedidos: number;
  entregues: number;
  receitaCentavos: number;
  conversao: number;
}

/**
 * A tabela que responde a pergunta que motivou tudo isto: TikTok ou Instagram?
 *
 * Note que a conversão é calculada **por origem**, e não herdada da média. Uma
 * origem que traz 500 pessoas e vende 2 é pior que uma que traz 40 e vende 6,
 * e só a coluna de conversão mostra isso — o número de visitas sozinho premia
 * quem traz volume vazio.
 */
export function porOrigem(janela: Janela): LinhaDeOrigem[] {
  const corte = desde(janela);
  const filtro = corte ? 'AND criado_em >= @corte' : '';

  const visitas = db
    .prepare(
      `SELECT coalesce(origem, 'direto') origem, count(DISTINCT visitante) n
         FROM visitas WHERE 1=1 ${filtro} GROUP BY origem`
    )
    .all({ corte }) as { origem: string; n: number }[];

  const pedidos = db
    .prepare(
      `SELECT coalesce(origem, 'direto') origem, status, produto, desconto_percentual
         FROM pedidos WHERE exemplo = 0 ${filtro}`
    )
    .all({ corte }) as {
    origem: string;
    status: string;
    produto: string;
    desconto_percentual: number | null;
  }[];

  const mapa = new Map<string, LinhaDeOrigem>();
  const garantir = (origem: string) => {
    if (!mapa.has(origem)) {
      mapa.set(origem, {
        origem,
        visitantes: 0,
        pedidos: 0,
        entregues: 0,
        receitaCentavos: 0,
        conversao: 0,
      });
    }
    return mapa.get(origem)!;
  };

  for (const v of visitas) garantir(v.origem).visitantes = v.n;
  for (const p of pedidos) {
    const linha = garantir(p.origem);
    linha.pedidos += 1;
    if (p.status === 'entregue') {
      linha.entregues += 1;
      linha.receitaCentavos += precoDoPedido(p).finalCentavos;
    }
  }

  for (const linha of mapa.values()) {
    linha.conversao = linha.visitantes
      ? (linha.entregues / linha.visitantes) * 100
      : 0;
  }

  return [...mapa.values()].sort((a, b) => b.visitantes - a.visitantes);
}

/* ── páginas, aparelhos, horas ─────────────────────────────────────────── */

export function paginasMaisVistas(janela: Janela, limite = 8) {
  const corte = desde(janela);
  return db
    .prepare(
      `SELECT caminho, count(*) visitas, count(DISTINCT visitante) visitantes
         FROM visitas WHERE 1=1 ${corte ? 'AND criado_em >= @corte' : ''}
        GROUP BY caminho ORDER BY visitas DESC LIMIT @limite`
    )
    .all({ corte, limite }) as {
    caminho: string;
    visitas: number;
    visitantes: number;
  }[];
}

export function porDispositivo(janela: Janela) {
  const corte = desde(janela);
  return db
    .prepare(
      `SELECT coalesce(dispositivo, 'desconhecido') dispositivo,
              count(DISTINCT visitante) n
         FROM visitas WHERE 1=1 ${corte ? 'AND criado_em >= @corte' : ''}
        GROUP BY dispositivo ORDER BY n DESC`
    )
    .all({ corte }) as { dispositivo: string; n: number }[];
}

/**
 * Movimento por hora do dia. Serve para escolher a hora de postar.
 *
 * Devolve sempre as 24 posições, mesmo as zeradas — um gráfico de hora com
 * barras faltando é ilegível.
 */
export function porHora(janela: Janela): number[] {
  const corte = desde(janela);
  const linhas = db
    .prepare(
      `SELECT cast(strftime('%H', criado_em, '${FUSO}') AS INTEGER) h, count(*) n
         FROM visitas WHERE 1=1 ${corte ? 'AND criado_em >= @corte' : ''}
        GROUP BY h`
    )
    .all({ corte }) as { h: number; n: number }[];

  const horas = Array(24).fill(0);
  for (const l of linhas) horas[l.h] = l.n;
  return horas;
}

/* ── o funil ───────────────────────────────────────────────────────────── */

export interface DegrauDoFunil {
  rotulo: string;
  n: number;
  /** % em relação ao degrau anterior. O primeiro é sempre 100. */
  doAnterior: number;
}

/**
 * Onde as pessoas somem.
 *
 * A queda **entre degraus** é o que importa, não o valor absoluto — por isso a
 * porcentagem é sempre em relação ao passo anterior, e não ao topo. É a
 * diferença entre "só 3% compram" (verdadeiro e inútil) e "80% que chegam no
 * pagamento não terminam" (acionável).
 */
export function funil(janela: Janela): DegrauDoFunil[] {
  const corte = desde(janela);
  const filtroV = corte ? 'AND criado_em >= @corte' : '';
  const filtroP = corte ? 'AND criado_em >= @corte' : '';

  const um = (sql: string) =>
    (db.prepare(sql).get({ corte }) as { n: number }).n;

  const visitantes = um(
    `SELECT count(DISTINCT visitante) n FROM visitas WHERE 1=1 ${filtroV}`
  );
  const abriuRitual = um(
    `SELECT count(DISTINCT visitante) n FROM visitas
      WHERE caminho LIKE '/ritual%' ${filtroV}`
  );
  const terminou = um(
    `SELECT count(*) n FROM pedidos WHERE exemplo = 0 ${filtroP}`
  );
  const pagou = um(
    `SELECT count(*) n FROM pedidos
      WHERE exemplo = 0 AND status IN ('pago','gerando','entregue') ${filtroP}`
  );
  const recebeu = um(
    `SELECT count(*) n FROM pedidos
      WHERE exemplo = 0 AND status = 'entregue' ${filtroP}`
  );

  const bruto = [
    { rotulo: 'Chegaram no site', n: visitantes },
    { rotulo: 'Abriram o ritual', n: abriuRitual },
    { rotulo: 'Terminaram as 26 cenas', n: terminou },
    { rotulo: 'Pagaram', n: pagou },
    { rotulo: 'Receberam', n: recebeu },
  ];

  return bruto.map((d, i) => ({
    ...d,
    doAnterior: i === 0 ? 100 : bruto[i - 1].n ? (d.n / bruto[i - 1].n) * 100 : 0,
  }));
}

/* ── quem está online agora ────────────────────────────────────────────── */

/**
 * Visitantes distintos nos últimos `minutos`.
 *
 * Existe para duas coisas: o indicador "agora" no painel e o script que
 * checa se dá para reiniciar a VPS sem derrubar alguém no meio do ritual.
 */
export function online(minutos = 5): number {
  const corte = new Date(Date.now() - minutos * 60_000).toISOString();
  const linha = db
    .prepare(
      'SELECT count(DISTINCT visitante) n FROM visitas WHERE criado_em >= ?'
    )
    .get(corte) as { n: number };
  return linha.n;
}

/** O que essas pessoas estão olhando, para o painel mostrar em tempo real. */
export function ondeEstaoAgora(minutos = 5) {
  const corte = new Date(Date.now() - minutos * 60_000).toISOString();
  return db
    .prepare(
      `SELECT caminho, count(DISTINCT visitante) n FROM visitas
        WHERE criado_em >= ? GROUP BY caminho ORDER BY n DESC LIMIT 6`
    )
    .all(corte) as { caminho: string; n: number }[];
}

/* ── escrita ───────────────────────────────────────────────────────────── */

/**
 * As origens que reconhecemos. Qualquer outra coisa vira `outro`.
 *
 * A lista fechada não é preciosismo: sem ela, um link malicioso com
 * `?de=<script>` viraria uma linha na tabela do painel, e o painel renderiza
 * o valor. É a defesa mais barata contra injeção via parâmetro de URL.
 */
/**
 * A taxonomia de origem mora em `lib/rastreio.ts`.
 *
 * Ela estava duplicada aqui e no proxy, com listas diferentes — e duas listas
 * que deveriam ser iguais viram uma só quando alguém edita a errada. Isso é
 * reexportação, não cópia: quem já importava daqui continua funcionando.
 */
export {
  ORIGENS_CONHECIDAS,
  normalizarOrigem,
  origemDoReferer,
} from './rastreio';

export function registrarVisita(v: {
  visitante: string;
  caminho: string;
  origem: string | null;
  referencia: string | null;
  dispositivo: string | null;
  /**
   * A campanha DESTE toque, não a que levou o crédito.
   *
   * O pedido guarda um crédito só; aqui fica a sequência. Quem clicou na
   * campanha A na terça e na B na quinta deixa duas linhas, e "de qual link
   * essa venda veio mesmo?" passa a ter resposta em vez de opinião — o que
   * importa agora que a campanha escolhe em qual conta o dinheiro cai.
   */
  campanha_id?: string | null;
  peca_id?: string | null;
}): void {
  db.prepare(
    `INSERT INTO visitas
      (visitante, caminho, origem, referencia, dispositivo, campanha_id, peca_id, criado_em)
     VALUES (@visitante, @caminho, @origem, @referencia, @dispositivo,
       @campanha_id, @peca_id, @agora)`
  ).run({ campanha_id: null, peca_id: null, ...v, agora: new Date().toISOString() });
}

/* ── marcos da jornada ─────────────────────────────────────────────────── */

/**
 * Os passos que rastreamos, em ordem. **Lista fechada de propósito.**
 *
 * A rota que grava só aceita nomes daqui. Sem isso, qualquer pessoa poderia
 * encher a tabela com nomes inventados — e o painel renderiza esses nomes.
 *
 * `cena` carrega o número da pergunta em `valor`, e é o marco que responde a
 * pergunta cara: não "abriu o ritual" (um degrau só), mas a curva inteira de
 * desistência pergunta a pergunta.
 */
export const MARCOS = [
  'landing',
  'landing_meio',
  'landing_fim',
  'cta',
  'ritual_aberto',
  'cena',
  'nome_ok',
  'data_ok',
  'hora_ok',
  'email_ok',
  'plano_visto',
  'pedido_criado',
  'pagamento_aberto',
  /**
   * Os três degraus que faltavam entre "viu a oferta" e "pagou".
   *
   * `pagamento_aberto` dispara no CLIQUE do plano, antes do redirecionamento —
   * então ele nunca soube dizer se a pessoa chegou a ver o checkout. E os dois
   * planos disparavam o mesmo marco, o que apagava a informação de qual
   * chamou mais.
   *
   * `checkout_aberto` é a tela de pagamento renderizada de verdade. A queda
   * entre ele e `pagamento_aberto` é gente que clicou e não chegou — o degrau
   * mais caro do funil, e o único que estava invisível.
   */
  'plano_revelacao',
  'plano_completa',
  /** O terceiro degrau da oferta: o plano de 30 dias. */
  'plano_assinatura',
  /**
   * Os três botões da tela de oferta de 19/08.
   *
   * `plano_revelacao` e `plano_completa` mediam os produtos antigos e não
   * cobrem mais nada: a escada agora é 7,90 avulso, 15,90 avulso e o mensal.
   * Sem estes três, a tela mais importante do funil novo — a única que a
   * pessoa vê com a atenção inteira, logo depois do ritual — não dizia qual
   * degrau chamava mais, nem se algum deles não chamava nunca.
   */
  'oferta_simples',
  'oferta_completa',
  'oferta_mensal',
  'checkout_aberto',
  /**
   * Qual meio a pessoa escolheu no checkout.
   *
   * Só disparam na TROCA de aba: o Pix já vem selecionado, então
   * `checkout_cartao` conta quem ativamente recusou o Pix, e `checkout_pix`
   * conta quem foi ao cartão e voltou. Contar a seleção inicial faria
   * `checkout_pix` empatar com `checkout_aberto` e não diria nada.
   *
   * A leitura que interessa: cartão muito clicado e pouco pago é formulário
   * caro demais, não preço alto demais.
   */
  'checkout_pix',
  'checkout_cartao',
  'pagamento_tentado',
  /**
   * Os passos do funil longo (`/familiar`), um por tela.
   *
   * Sem eles o painel via a entrada e a saída e nada no meio — impossível
   * saber em qual dos doze passos as pessoas desistiam, que é a única
   * pergunta que um funil comprido precisa responder. O curto já era medível
   * por `cena` com o número; este tem telas de tipos diferentes, então cada
   * uma tem o seu nome.
   */
  'funil_genero',
  'funil_nascimento',
  'funil_hora',
  'funil_cidade',
  'funil_lendo',
  'funil_energia1',
  'funil_coracao',
  'funil_objetivos',
  'funil_cor',
  'funil_elemento',
  'funil_energia2',
  'funil_recap',
  'funil_palma',
  'funil_revelacao',
  'funil_email',
] as const;

export type Marco = (typeof MARCOS)[number];

export function ehMarco(v: unknown): v is Marco {
  return typeof v === 'string' && (MARCOS as readonly string[]).includes(v);
}

export function registrarMarco(m: {
  visitante: string;
  marco: Marco;
  valor: number | null;
  origem: string | null;
}): void {
  db.prepare(
    `INSERT INTO marcos (visitante, marco, valor, origem, criado_em)
     VALUES (@visitante, @marco, @valor, @origem, @agora)`
  ).run({ ...m, agora: new Date().toISOString() });
}

/** Quantas PESSOAS distintas chegaram a cada marco. */
export function pessoasPorMarco(janela: Janela): Record<string, number> {
  const corte = desde(janela);
  const linhas = db
    .prepare(
      `SELECT marco, count(DISTINCT visitante) n FROM marcos
        WHERE 1=1
          ${corte ? 'AND criado_em >= @corte' : ''}
        GROUP BY marco`
    )
    .all({ corte }) as { marco: string; n: number }[];

  return Object.fromEntries(linhas.map((l) => [l.marco, l.n]));
}

/**
 * A curva de desistência cena a cena.
 *
 * Devolve, para cada uma das cenas, quantas pessoas distintas chegaram a
 * respondê-la. A leitura útil é a **diferença entre vizinhas**: uma queda de
 * 40 para 12 entre a cena 6 e a 7 aponta um problema na cena 7, e nenhuma
 * métrica agregada mostraria isso.
 */
export function curvaDasCenas(
  janela: Janela,
  totalDeCenas: number
): { cena: number; pessoas: number }[] {
  const corte = desde(janela);
  const linhas = db
    .prepare(
      `SELECT valor, count(DISTINCT visitante) n FROM marcos
        WHERE marco = 'cena' AND valor IS NOT NULL
          ${corte ? 'AND criado_em >= @corte' : ''}
        GROUP BY valor`
    )
    .all({ corte }) as { valor: number; n: number }[];

  const mapa = new Map(linhas.map((l) => [l.valor, l.n]));
  return Array.from({ length: totalDeCenas }, (_, i) => ({
    cena: i + 1,
    pessoas: mapa.get(i + 1) ?? 0,
  }));
}

