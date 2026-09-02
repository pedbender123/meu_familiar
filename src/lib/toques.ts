import Database from 'better-sqlite3';
import { BANCO } from './caminhos';
import { MARCAS_DE_EMAIL, type Toque, type TipoDeToque } from './rastreio';
import { precoDoPedido } from './cupons';

const db = new Database(BANCO);

/**
 * A jornada, uma linha por chegada.
 *
 * ── Por que é tabela e não coluna ─────────────────────────────────────────
 *
 * A pergunta "de onde veio essa venda" parece ter uma resposta só, e não tem.
 * A pessoa viu o vídeo 02 no Instagram, entrou, saiu; três dias depois clicou
 * no e-mail de resgate; uma semana depois voltou pelo remarketing e comprou.
 * Isso são três respostas verdadeiras ao mesmo tempo, e a única forma de não
 * escolher uma e apagar as outras é guardar todas.
 *
 * O painel usa isso de dois jeitos: a **atribuição** (uma linha, a que leva o
 * crédito) e a **jornada** (todas, na ordem, para você ver o caminho).
 */
export interface LinhaDeToque {
  id: number;
  visitante: string;
  tipo: TipoDeToque;
  origem: string | null;
  campanha_id: string | null;
  peca_id: string | null;
  indicado_por: string | null;
  conta_aquisicao: number;
  caminho: string;
  referencia: string | null;
  criado_em: string;
}

export function registrarToque(t: {
  visitante: string;
  tipo: TipoDeToque;
  origem?: string | null;
  campanhaId?: string | null;
  pecaId?: string | null;
  indicadoPor?: string | null;
  contaAquisicao: boolean;
  caminho: string;
  referencia?: string | null;
}): void {
  db.prepare(
    `INSERT INTO toques
       (visitante, tipo, origem, campanha_id, peca_id, indicado_por,
        conta_aquisicao, caminho, referencia, criado_em)
     VALUES (@visitante, @tipo, @origem, @campanhaId, @pecaId, @indicadoPor,
        @contaAquisicao, @caminho, @referencia, @criado_em)`
  ).run({
    visitante: t.visitante,
    tipo: t.tipo,
    origem: t.origem ?? null,
    campanhaId: t.campanhaId ?? null,
    pecaId: t.pecaId ?? null,
    indicadoPor: t.indicadoPor ?? null,
    contaAquisicao: t.contaAquisicao ? 1 : 0,
    caminho: t.caminho,
    referencia: t.referencia ?? null,
    criado_em: new Date().toISOString(),
  });
}

/**
 * Um toque por visitante por tipo a cada meia hora.
 *
 * Sem isto, cada recarga de página vira uma linha e a jornada de uma pessoa
 * que navegou dez minutos fica ilegível — o que importa é "voltou pelo
 * e-mail", não "voltou pelo e-mail e apertou F5 quatro vezes". Meia hora é
 * curto o bastante para separar duas sessões de verdade e longo o bastante
 * para colapsar uma sessão só.
 */
export function toqueRecenteIgual(
  visitante: string,
  tipo: TipoDeToque,
  minutos = 30
): boolean {
  const corte = new Date(Date.now() - minutos * 60_000).toISOString();
  const linha = db
    .prepare(
      `SELECT id FROM toques
        WHERE visitante = ? AND tipo = ? AND criado_em >= ?
        LIMIT 1`
    )
    .get(visitante, tipo, corte);
  return !!linha;
}

/** A jornada de uma pessoa, do primeiro toque ao último. */
export function jornadaDoVisitante(visitante: string): LinhaDeToque[] {
  return db
    .prepare('SELECT * FROM toques WHERE visitante = ? ORDER BY criado_em')
    .all(visitante) as LinhaDeToque[];
}

/** O primeiro toque que pode levar crédito — a aquisição de verdade. */
export function primeiroToqueDeAquisicao(
  visitante: string
): LinhaDeToque | undefined {
  return db
    .prepare(
      `SELECT * FROM toques
        WHERE visitante = ? AND conta_aquisicao = 1
        ORDER BY criado_em LIMIT 1`
    )
    .get(visitante) as LinhaDeToque | undefined;
}

/**
 * A jornada em português, pronta para a tela.
 *
 * O painel não deve montar frase a partir de `tipo` — se essa tradução
 * morasse no componente, cada tela escreveria a sua e elas divergiriam.
 */
export function descreverToque(
  t: LinhaDeToque,
  nomes: { campanha?: string; peca?: string; indicadoPor?: string } = {}
): string {
  switch (t.tipo) {
    case 'campanha': {
      const c = nomes.campanha ?? 'campanha';
      return nomes.peca ? `${c} — ${nomes.peca}` : c;
    }
    case 'compartilhamento':
      return nomes.indicadoPor
        ? `Link compartilhado por ${nomes.indicadoPor}`
        : 'Link compartilhado por alguém';
    case 'remarketing':
      return 'E-mail de remarketing';
    case 'email':
      return 'E-mail (retorno)';
    case 'social':
      // 'outro' é o fallback de "tinha `?de=` ou referer, mas não bateu com
      // nada reconhecido" — dizer só "outro" é tão vago quanto não dizer
      // nada. O host real já está gravado em `referencia`; mostrar ele é o
      // que transforma "outro" em "ah, era o Pinterest" ou "era um bit.ly".
      if (t.origem === 'outro') {
        return t.referencia ? `Origem não reconhecida (${t.referencia})` : 'Origem não reconhecida';
      }
      return t.origem ? `Veio do ${t.origem}` : 'Rede social';
    case 'direto':
      return 'Acesso direto';
    default:
      return t.tipo;
  }
}

/**
 * Quantos toques de cada tipo, numa janela.
 *
 * `conta_aquisicao` entra separado porque a soma dos dois é a pergunta
 * errada: misturar retorno com aquisição é exatamente o que fazia o canal
 * "e-mail" parecer produtivo.
 */
export function resumoDeToques(desde: string | null): {
  tipo: string;
  aquisicoes: number;
  retornos: number;
  pessoas: number;
}[] {
  const filtro = desde ? 'WHERE criado_em >= ?' : '';
  return db
    .prepare(
      `SELECT tipo,
              SUM(CASE WHEN conta_aquisicao = 1 THEN 1 ELSE 0 END) AS aquisicoes,
              SUM(CASE WHEN conta_aquisicao = 0 THEN 1 ELSE 0 END) AS retornos,
              COUNT(DISTINCT visitante) AS pessoas
         FROM toques ${filtro}
        GROUP BY tipo
        ORDER BY aquisicoes DESC`
    )
    .all(...(desde ? [desde] : [])) as {
    tipo: string;
    aquisicoes: number;
    retornos: number;
    pessoas: number;
  }[];
}

/** Só para a tela de e-mails: qual marcador trouxe quanta gente de volta. */
export const ROTULOS_DE_EMAIL = MARCAS_DE_EMAIL;

export type { Toque };

/* ── a jornada, pronta para a tela ───────────────────────────────────────── */

export interface PassoDaJornada {
  quando: string;
  tipo: TipoDeToque;
  /** Frase pronta: "Instagram — vídeo do gato preto". */
  rotulo: string;
  /** Se este passo pode levar crédito de aquisição. */
  conta: boolean;
  /** Para onde a tela navega ao clicar. Nulo quando não há destino. */
  destino: string | null;
  caminho: string;
}

/**
 * A jornada de uma pessoa em português, com os nomes já resolvidos.
 *
 * ── Por que os nomes são resolvidos aqui ──────────────────────────────────
 *
 * A tabela guarda ids. Uma tela que recebesse ids teria que consultar
 * campanha, peça e pedido por linha — e a próxima tela faria o mesmo de um
 * jeito ligeiramente diferente, até as duas discordarem sobre como se chama
 * a mesma peça. Resolver uma vez, aqui, mantém uma versão só da verdade.
 */
export function jornadaLegivel(visitante: string): PassoDaJornada[] {
  const linhas = jornadaDoVisitante(visitante);
  if (linhas.length === 0) return [];

  const campanhas = new Map<string, string>();
  const pecas = new Map<string, string>();
  const indicadores = new Map<string, string>();

  for (const t of linhas) {
    if (t.campanha_id && !campanhas.has(t.campanha_id)) {
      const c = db
        .prepare('SELECT nome FROM campanhas WHERE id = ?')
        .get(t.campanha_id) as { nome: string } | undefined;
      if (c) campanhas.set(t.campanha_id, c.nome);
    }
    if (t.peca_id && !pecas.has(t.peca_id)) {
      const p = db
        .prepare('SELECT nome FROM pecas WHERE id = ?')
        .get(t.peca_id) as { nome: string } | undefined;
      if (p) pecas.set(t.peca_id, p.nome);
    }
    if (t.indicado_por && !indicadores.has(t.indicado_por)) {
      const q = db
        .prepare('SELECT nome FROM pedidos WHERE id = ?')
        .get(t.indicado_por) as { nome: string } | undefined;
      if (q) indicadores.set(t.indicado_por, q.nome);
    }
  }

  return linhas.map((t) => ({
    quando: t.criado_em,
    tipo: t.tipo as TipoDeToque,
    rotulo: descreverToque(t, {
      campanha: t.campanha_id ? campanhas.get(t.campanha_id) : undefined,
      peca: t.peca_id ? pecas.get(t.peca_id) : undefined,
      indicadoPor: t.indicado_por ? indicadores.get(t.indicado_por) : undefined,
    }),
    conta: t.conta_aquisicao === 1,
    destino: t.campanha_id
      ? `/painel/campanhas/${t.campanha_id}`
      : t.indicado_por
        ? `/painel/pedidos?q=${t.indicado_por}`
        : null,
    caminho: t.caminho,
  }));
}

/**
 * A jornada de quem fez um pedido, achando o visitante pelo próprio pedido.
 *
 * Atalho para a tela de pedidos, que tem o pedido em mãos e não o cookie.
 */
export function jornadaDoPedido(pedidoId: string): PassoDaJornada[] {
  const p = db
    .prepare('SELECT visitante FROM pedidos WHERE id = ?')
    .get(pedidoId) as { visitante: string | null } | undefined;
  return p?.visitante ? jornadaLegivel(p.visitante) : [];
}

/**
 * Onde as vendas nasceram, por canal, já separando aquisição de retorno.
 *
 * `atribuicao` diz COMO o crédito foi decidido — e `legado` é honesto: são os
 * pedidos anteriores ao rastreio por peça, dos quais só se sabe o canal.
 */
export function vendasPorAtribuicao(desde: string | null): {
  atribuicao: string;
  origem: string | null;
  pedidos: number;
  vendas: number;
}[] {
  const filtro = desde ? 'AND criado_em >= ?' : '';
  return db
    .prepare(
      `SELECT COALESCE(atribuicao, 'legado') AS atribuicao,
              origem,
              COUNT(*) AS pedidos,
              SUM(CASE WHEN status IN ('pago','gerando','entregue')
                       THEN 1 ELSE 0 END) AS vendas
         FROM pedidos
        WHERE exemplo = 0 ${filtro}
        GROUP BY atribuicao, origem
        ORDER BY vendas DESC, pedidos DESC`
    )
    .all(...(desde ? [desde] : [])) as {
    atribuicao: string;
    origem: string | null;
    pedidos: number;
    vendas: number;
  }[];
}

/**
 * O resultado de cada funil, lado a lado.
 *
 * ── O que faz esta comparação ser honesta ─────────────────────────────────
 *
 * Só entram pedidos com `funil` gravado. Os anteriores ao teste ficam de fora
 * em vez de virar linha "sem funil" com número grande: misturá-los daria a um
 * dos lados o histórico inteiro do site e a comparação diria qualquer coisa.
 *
 * O denominador é gente que CHEGOU no funil, não pedidos criados. Comparar
 * "vendas por pedido" premiaria o funil que só deixa passar quem já ia
 * comprar; a pergunta é qual deles transforma mais visitante em venda.
 */
export function comparacaoDeFunis(desde: string | null): {
  funil: string;
  pessoas: number;
  pedidos: number;
  vendas: number;
  receitaCentavos: number;
}[] {
  const filtro = desde ? 'AND p.criado_em >= ?' : '';
  const args = desde ? [desde] : [];

  const pedidos = db
    .prepare(
      `SELECT p.funil AS funil, p.status, p.produto, p.desconto_percentual, p.bumps_centavos,
              p.visitante
         FROM pedidos p
        WHERE p.exemplo = 0 AND p.funil IS NOT NULL ${filtro}`
    )
    .all(...args) as {
    funil: string;
    status: string;
    produto: string;
    desconto_percentual: number | null;
    bumps_centavos: number | null;
    visitante: string | null;
  }[];

  // Quem chegou em cada funil sai dos MARCOS, não dos pedidos: `ritual_aberto`
  // é disparado na primeira tela, antes de qualquer campo preenchido.
  const chegadas = db
    .prepare(
      `SELECT v.caminho AS caminho, COUNT(DISTINCT v.visitante) AS pessoas
         FROM visitas v
        WHERE v.caminho IN ('/familiar', '/vendas', '/atravessar')
          ${desde ? 'AND v.criado_em >= ?' : ''}
        GROUP BY v.caminho`
    )
    .all(...args) as { caminho: string; pessoas: number }[];

  const pessoasDe = (funil: string) => {
    const caminhos =
      funil === 'familiar' ? ['/familiar'] : ['/vendas', '/atravessar'];
    return chegadas
      .filter((c) => caminhos.includes(c.caminho))
      .reduce((s, c) => s + c.pessoas, 0);
  };

  const porFunil = new Map<string, { pedidos: number; vendas: number; receita: number }>();
  for (const p of pedidos) {
    const atual = porFunil.get(p.funil) ?? { pedidos: 0, vendas: 0, receita: 0 };
    atual.pedidos += 1;
    if (['pago', 'gerando', 'entregue'].includes(p.status)) {
      atual.vendas += 1;
      atual.receita += precoDoPedido(p).finalCentavos;
    }
    porFunil.set(p.funil, atual);
  }

  return [...porFunil]
    .map(([funil, v]) => ({
      funil,
      pessoas: pessoasDe(funil),
      pedidos: v.pedidos,
      vendas: v.vendas,
      receitaCentavos: v.receita,
    }))
    .sort((a, b) => b.vendas - a.vendas || b.pessoas - a.pessoas);
}
