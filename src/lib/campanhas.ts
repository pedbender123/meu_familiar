import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { BANCO } from './caminhos';
import { precoDoPedido, receitaDoPedido } from './cupons';

const db = new Database(BANCO);

export interface Campanha {
  id: string;
  nome: string;
  plataforma: string | null;
  /**
   * Os dois caracteres que viajam na URL (`?c=ig01` → `ig`).
   *
   * Nulo nas campanhas criadas antes do rastreio por peça — elas continuam
   * medidas por janela de tempo, que é tudo que se sabia sobre elas.
   */
  codigo: string | null;
  /**
   * As páginas de venda desta campanha, em JSON.
   *
   * Uma só: todo mundo que chegar por ela vê aquela. Mais de uma: teste A/B
   * entre elas. Nulo nas campanhas criadas antes disto existir — elas caem no
   * funil padrão, que é como sempre funcionaram.
   */
  funis: string | null;
  /** ISO. Início da janela que o relatório considera. */
  inicio: string;
  /** ISO, ou `null` enquanto a campanha ainda está no ar. */
  fim: string | null;
  investido_centavos: number;
  alcance_estimado: number | null;
  nota: string | null;
  criado_em: string;
  atualizado_em: string;
}

export function listarCampanhas(): Campanha[] {
  return db
    .prepare('SELECT * FROM campanhas ORDER BY inicio DESC')
    .all() as Campanha[];
}

export function buscarCampanha(id: string): Campanha | undefined {
  return db.prepare('SELECT * FROM campanhas WHERE id = ?').get(id) as
    | Campanha
    | undefined;
}

export function criarCampanha(c: {
  nome: string;
  plataforma?: string | null;
  codigo?: string | null;
  funis?: string | null;
  inicio: string;
  fim?: string | null;
  investido_centavos?: number;
  alcance_estimado?: number | null;
  nota?: string | null;
}): string {
  const id = randomUUID();
  const agora = new Date().toISOString();

  /**
   * Código repetido vira erro legível, não exceção do SQLite.
   *
   * O índice único já impede a duplicata — mas ele estoura com
   * "UNIQUE constraint failed", que sobe como erro 500 e não diz a quem está
   * criando a campanha que basta escolher outras duas letras. Quando o código
   * é escolhido à mão, a colisão é o erro mais provável de todos.
   */
  const codigo = c.codigo
    ? normalizarCodigo(c.codigo)
    : proximoCodigoLivre(c.plataforma ?? undefined);

  if (codigo.length < 2) {
    throw new Error('O código precisa de dois caracteres — letras ou números.');
  }
  if (!codigoEstaLivre(codigo)) {
    throw new Error(`O código "${codigo}" já é de outra campanha. Escolha outro.`);
  }
  db.prepare(
    `INSERT INTO campanhas
      (id, nome, plataforma, codigo, funis, inicio, fim, investido_centavos,
       alcance_estimado, nota, criado_em, atualizado_em)
     VALUES (@id, @nome, @plataforma, @codigo, @funis, @inicio, @fim,
       @investido_centavos, @alcance_estimado, @nota, @agora, @agora)`
  ).run({
    id,
    plataforma: null,
    funis: null,
    fim: null,
    investido_centavos: 0,
    alcance_estimado: null,
    nota: null,
    ...c,
    codigo,
    agora,
  });
  return id;
}

/** Dois caracteres, só letra e número, minúsculo. É o que cabe na URL. */
export function normalizarCodigo(bruto: string): string {
  return bruto.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 2);
}

export function codigoEstaLivre(codigo: string, exceto?: string): boolean {
  const linha = db
    .prepare('SELECT id FROM campanhas WHERE codigo = ?')
    .get(normalizarCodigo(codigo)) as { id: string } | undefined;
  return !linha || linha.id === exceto;
}

/**
 * Um código livre, quando quem cria não escolheu.
 *
 * Tenta as iniciais da plataforma primeiro (`in` para Instagram) porque
 * código legível é código que você reconhece no relatório sem consultar nada.
 * Se colidir, cai para pares sequenciais — feio, mas único, e único é o
 * requisito de verdade.
 */
function proximoCodigoLivre(preferido?: string): string {
  if (preferido) {
    const p = normalizarCodigo(preferido);
    if (p.length === 2 && codigoEstaLivre(p)) return p;
  }
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  for (const a of letras) {
    for (const b of '0123456789' + letras) {
      const tentativa = a + b;
      if (codigoEstaLivre(tentativa)) return tentativa;
    }
  }
  throw new Error('sem código de campanha livre');
}

export function buscarCampanhaPorCodigo(codigo: string): Campanha | undefined {
  return db
    .prepare('SELECT * FROM campanhas WHERE codigo = ?')
    .get(normalizarCodigo(codigo)) as Campanha | undefined;
}

/* ── peças: os vídeos e criativos de uma campanha ───────────────────────── */

export interface Peca {
  id: string;
  campanha_id: string;
  codigo: string;
  nome: string;
  nota: string | null;
  ativa: number;
  criado_em: string;
}

export function listarPecas(campanhaId: string): Peca[] {
  return db
    .prepare('SELECT * FROM pecas WHERE campanha_id = ? ORDER BY codigo')
    .all(campanhaId) as Peca[];
}

export function buscarPeca(campanhaId: string, codigo: string): Peca | undefined {
  return db
    .prepare('SELECT * FROM pecas WHERE campanha_id = ? AND codigo = ?')
    .get(campanhaId, codigo.toLowerCase()) as Peca | undefined;
}

/**
 * Cria uma peça com o próximo código sequencial (`01`, `02`, `03`…).
 *
 * Sequencial e não aleatório porque você vai ler estes códigos em relatório e
 * ditá-los ao configurar o anúncio. `ig01` e `ig02` você distingue de
 * relance; `ig7k` e `igq2` você confunde.
 */
export function criarPeca(p: {
  campanha_id: string;
  nome: string;
  nota?: string | null;
}): { ok: true; id: string; codigo: string } | { ok: false; erro: string } {
  const usados = new Set(listarPecas(p.campanha_id).map((x) => x.codigo));
  let codigo = '';
  for (let n = 1; n <= 99; n++) {
    const tentativa = String(n).padStart(2, '0');
    if (!usados.has(tentativa)) {
      codigo = tentativa;
      break;
    }
  }
  if (!codigo) return { ok: false, erro: 'Esta campanha já tem 99 peças.' };

  const id = randomUUID();
  db.prepare(
    `INSERT INTO pecas (id, campanha_id, codigo, nome, nota, ativa, criado_em)
     VALUES (@id, @campanha_id, @codigo, @nome, @nota, 1, @criado_em)`
  ).run({
    id,
    campanha_id: p.campanha_id,
    codigo,
    nome: p.nome,
    nota: p.nota ?? null,
    criado_em: new Date().toISOString(),
  });
  return { ok: true, id, codigo };
}

export function apagarPeca(id: string): void {
  db.prepare('DELETE FROM pecas WHERE id = ?').run(id);
}

/** O link que vai no anúncio. Curto de propósito — ver `lib/rastreio.ts`. */
export function linkDaPeca(campanha: Campanha, peca?: Peca | null): string {
  const base = process.env.BASE_URL || 'https://bruxario.com.br';
  if (!campanha.codigo) return base;
  return `${base}/?c=${campanha.codigo}${peca ? peca.codigo : ''}`;
}

export function atualizarCampanha(id: string, campos: Partial<Campanha>): void {
  const chaves = Object.keys(campos).filter((k) => k !== 'id');
  if (chaves.length === 0) return;
  const set = chaves.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE campanhas SET ${set}, atualizado_em = @atualizado_em WHERE id = @id`
  ).run({ ...campos, id, atualizado_em: new Date().toISOString() });
}

export function apagarCampanha(id: string): void {
  db.prepare('DELETE FROM campanhas WHERE id = ?').run(id);
}

/* ── o relatório ─────────────────────────────────────────────────────────── */

export interface PessoaDoPeriodo {
  visitante: string;
  /** Quantas visitas de página essa pessoa fez no período. */
  visitas: number;
  /** Cena mais alta que ela alcançou. 0 = nunca começou a responder. */
  cenaMaxima: number;
  origem: string | null;
  dispositivo: string | null;
  primeiraVez: string;
  ultimaVez: string;
  /** Preenchidos só quando ela deixou e-mail (rascunho) ou virou pedido. */
  email: string | null;
  nome: string | null;
  nascimento: string | null;
  familiar: string | null;
  statusPedido: string | null;
  pagouCentavos: number | null;
}

export interface RelatorioDoPeriodo {
  de: string;
  ate: string;
  /* ── alcance ── */
  visitantes: number;
  visitas: number;
  visitantesQueVoltaram: number;
  /* ── funil ── */
  iniciaramRitual: number;
  responderamAlgo: number;
  abandonaramNoMeio: number;
  terminaram: number;
  /* ── captura ── */
  emailsCapturados: number;
  emailsSoRascunho: number;
  /* ── o pedaço do funil que ficava invisível ── */
  escolheramRevelacao: number;
  escolheramCompleta: number;
  abriramCheckout: number;
  tentaramPagar: number;
  /** Quantos por método realmente tentado (pix, master, visa, bolbradesco...). */
  porMetodo: { metodo: string; tentativas: number; aprovadas: number }[];
  /** Motivos de recusa do MP, agrupados. Diz se o problema é nosso ou do cartão. */
  recusas: { motivo: string; n: number }[];
  /* ── dinheiro ── */
  pedidos: number;
  vendas: number;
  brutoCentavos: number;
  taxaCentavos: number;
  liquidoCentavos: number;
  custoIaCentavos: number;
  /* ── detalhe ── */
  porOrigem: { origem: string; pessoas: number; vendas: number }[];
  porDispositivo: { dispositivo: string; pessoas: number }[];
  porHora: { hora: string; visitantes: number; vendas: number }[];
  curvaDasCenas: { cena: number; pessoas: number }[];
  pessoas: PessoaDoPeriodo[];
}

/**
 * Tudo que aconteceu entre dois instantes.
 *
 * ── Por que uma função só, e não uma por métrica ──────────────────────────
 *
 * Porque o relatório precisa ser coerente consigo mesmo: se "visitantes" e
 * "vendas" viessem de chamadas separadas feitas em momentos diferentes,
 * alguém compraria no meio e os números não fechariam. Aqui as consultas
 * correm juntas sobre o mesmo intervalo fechado.
 *
 * ── Sem IP, de propósito ──────────────────────────────────────────────────
 *
 * "Quem voltou mais de uma vez" sai do id anônimo de visitante (cookie
 * primeiro-parte), não de IP. Além de ser o que a política de privacidade
 * promete, é mais preciso: IP de celular é compartilhado por milhares de
 * pessoas via NAT da operadora, então contar IP repetido acusaria gente que
 * nunca se viu como se fosse a mesma pessoa.
 */
export function relatorioDoPeriodo(
  de: string,
  ate: string,
  minutosPorBalde = 60
): RelatorioDoPeriodo {
  const j = { de, ate };

  const visitasLinhas = db
    .prepare(
      `SELECT visitante, count(*) n, min(criado_em) primeira, max(criado_em) ultima,
              max(origem) origem, max(dispositivo) dispositivo
         FROM visitas WHERE criado_em >= @de AND criado_em < @ate
        GROUP BY visitante`
    )
    .all(j) as {
    visitante: string;
    n: number;
    primeira: string;
    ultima: string;
    origem: string | null;
    dispositivo: string | null;
  }[];

  const cenaMax = db
    .prepare(
      `SELECT visitante, max(valor) alto FROM marcos
        WHERE marco = 'cena' AND valor IS NOT NULL
          AND criado_em >= @de AND criado_em < @ate
        GROUP BY visitante`
    )
    .all(j) as { visitante: string; alto: number }[];
  const mapaCena = new Map(cenaMax.map((c) => [c.visitante, c.alto]));

  const abriram = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT visitante FROM marcos
            WHERE marco = 'ritual_aberto' AND criado_em >= @de AND criado_em < @ate`
        )
        .all(j) as { visitante: string }[]
    ).map((r) => r.visitante)
  );

  const viramOferta = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT visitante FROM marcos
            WHERE marco = 'plano_visto' AND criado_em >= @de AND criado_em < @ate`
        )
        .all(j) as { visitante: string }[]
    ).map((r) => r.visitante)
  );

  /** Quantas PESSOAS distintas bateram um marco no período. */
  const pessoasNoMarco = (marco: string) =>
    (
      db
        .prepare(
          `SELECT count(DISTINCT visitante) n FROM marcos
            WHERE marco = @marco AND criado_em >= @de AND criado_em < @ate`
        )
        .get({ ...j, marco }) as { n: number }
    ).n;

  const rascunhos = db
    .prepare(
      `SELECT visitante, email, cena FROM rascunhos
        WHERE criado_em >= @de AND criado_em < @ate`
    )
    .all(j) as { visitante: string; email: string; cena: number }[];
  const mapaRascunho = new Map(rascunhos.map((r) => [r.visitante, r]));

  const pedidos = db
    .prepare(
      `SELECT id, visitante, nome, email, familiar, status, produto,
              desconto_percentual, respostas_json, bruto_centavos, taxa_centavos,
              liquido_centavos, custo_ia_centavos, origem, criado_em,
              metodo_tentado, metodo_pagamento, motivo_recusa
         FROM pedidos
        WHERE exemplo = 0 AND criado_em >= @de AND criado_em < @ate`
    )
    .all(j) as {
    id: string;
    visitante: string | null;
    nome: string;
    email: string;
    familiar: string;
    status: string;
    produto: string;
    desconto_percentual: number | null;
    respostas_json: string;
    bruto_centavos: number | null;
    taxa_centavos: number | null;
    liquido_centavos: number | null;
    custo_ia_centavos: number;
    origem: string | null;
    criado_em: string;
    metodo_tentado: string | null;
    metodo_pagamento: string | null;
    motivo_recusa: string | null;
  }[];

  const mapaPedido = new Map(
    pedidos.filter((p) => p.visitante).map((p) => [p.visitante!, p])
  );

  /* ── dinheiro ── */
  const entregues = pedidos.filter((p) => p.status === 'entregue');
  let brutoCentavos = 0;
  let taxaCentavos = 0;
  let liquidoCentavos = 0;
  for (const p of entregues) {
    // O bruto guardado vem do MP; quando falta (pedido por cupom de 100%,
    // provedor fake), cai no preço calculado — que é o que de fato valia.
    const bruto = receitaDoPedido(p);
    brutoCentavos += bruto;
    taxaCentavos += p.taxa_centavos ?? 0;
    liquidoCentavos += p.liquido_centavos ?? bruto - (p.taxa_centavos ?? 0);
  }
  const custoIaCentavos = pedidos.reduce(
    (s, p) => s + (p.custo_ia_centavos ?? 0),
    0
  );

  /* ── a lista de pessoas ── */
  const pessoas: PessoaDoPeriodo[] = visitasLinhas
    .map((v) => {
      const pedido = mapaPedido.get(v.visitante);
      const rascunho = mapaRascunho.get(v.visitante);
      let nascimento: string | null = null;
      if (pedido) {
        try {
          nascimento = JSON.parse(pedido.respostas_json).dataNascimento ?? null;
        } catch {
          nascimento = null;
        }
      }
      return {
        visitante: v.visitante,
        visitas: v.n,
        cenaMaxima: mapaCena.get(v.visitante) ?? 0,
        origem: v.origem,
        dispositivo: v.dispositivo,
        primeiraVez: v.primeira,
        ultimaVez: v.ultima,
        email: pedido?.email ?? rascunho?.email ?? null,
        nome: pedido?.nome ?? null,
        nascimento,
        familiar: pedido?.familiar ?? null,
        statusPedido: pedido?.status ?? null,
        pagouCentavos:
          pedido && pedido.status === 'entregue'
            ? receitaDoPedido(pedido)
            : null,
      };
    })
    .sort((a, b) => b.cenaMaxima - a.cenaMaxima || b.visitas - a.visitas);

  /* ── recortes ── */
  const contarPor = <T extends string>(
    chave: (p: PessoaDoPeriodo) => T | null
  ) => {
    const mapa = new Map<string, { pessoas: number; vendas: number }>();
    for (const p of pessoas) {
      const k = chave(p) ?? '(direto)';
      const linha = mapa.get(k) ?? { pessoas: 0, vendas: 0 };
      linha.pessoas += 1;
      if (p.statusPedido === 'entregue') linha.vendas += 1;
      mapa.set(k, linha);
    }
    return mapa;
  };

  const porOrigem = [...contarPor((p) => p.origem)]
    .map(([origem, v]) => ({ origem, ...v }))
    .sort((a, b) => b.pessoas - a.pessoas);

  const porDispositivo = [...contarPor((p) => p.dispositivo)]
    .map(([dispositivo, v]) => ({ dispositivo, pessoas: v.pessoas }))
    .sort((a, b) => b.pessoas - a.pessoas);

  /* ── série no tempo ── */
  const porHora = serieNoTempo(de, ate, minutosPorBalde, entregues);

  /* ── curva das cenas ── */
  const cenas = db
    .prepare(
      `SELECT valor, count(DISTINCT visitante) n FROM marcos
        WHERE marco = 'cena' AND valor IS NOT NULL
          AND criado_em >= @de AND criado_em < @ate
        GROUP BY valor ORDER BY valor`
    )
    .all(j) as { valor: number; n: number }[];

  const responderamAlgo = pessoas.filter((p) => p.cenaMaxima > 0).length;
  const terminaram = viramOferta.size;

  /* ── o que aconteceu no pagamento ── */
  const metodos = new Map<string, { tentativas: number; aprovadas: number }>();
  const motivos = new Map<string, number>();
  for (const p of pedidos) {
    const m = p.metodo_pagamento ?? p.metodo_tentado;
    if (m) {
      const linha = metodos.get(m) ?? { tentativas: 0, aprovadas: 0 };
      linha.tentativas += 1;
      if (p.status === 'entregue') linha.aprovadas += 1;
      metodos.set(m, linha);
    }
    if (p.motivo_recusa) {
      motivos.set(p.motivo_recusa, (motivos.get(p.motivo_recusa) ?? 0) + 1);
    }
  }

  return {
    de,
    ate,
    visitantes: visitasLinhas.length,
    visitas: visitasLinhas.reduce((s, v) => s + v.n, 0),
    visitantesQueVoltaram: visitasLinhas.filter((v) => v.n > 1).length,
    iniciaramRitual: abriram.size,
    responderamAlgo,
    abandonaramNoMeio: Math.max(0, responderamAlgo - terminaram),
    terminaram,
    emailsCapturados: new Set(
      pessoas.filter((p) => p.email).map((p) => p.email!)
    ).size,
    emailsSoRascunho: pessoas.filter((p) => p.email && !p.statusPedido).length,
    escolheramRevelacao: pessoasNoMarco('plano_revelacao'),
    escolheramCompleta: pessoasNoMarco('plano_completa'),
    abriramCheckout: pessoasNoMarco('checkout_aberto'),
    tentaramPagar: pessoasNoMarco('pagamento_tentado'),
    porMetodo: [...metodos]
      .map(([metodo, v]) => ({ metodo, ...v }))
      .sort((a, b) => b.tentativas - a.tentativas),
    recusas: [...motivos]
      .map(([motivo, n]) => ({ motivo, n }))
      .sort((a, b) => b.n - a.n),
    pedidos: pedidos.length,
    vendas: entregues.length,
    brutoCentavos,
    taxaCentavos,
    liquidoCentavos,
    custoIaCentavos,
    porOrigem,
    porDispositivo,
    porHora,
    curvaDasCenas: cenas.map((c) => ({ cena: c.valor, pessoas: c.n })),
    pessoas,
  };
}

/**
 * A série temporal, em baldes de N minutos.
 *
 * Os baldes são gerados por JavaScript e não por `strftime` porque o SQLite
 * não agrupa por intervalo arbitrário sem aritmética feia — e porque baldes
 * VAZIOS precisam existir no resultado. Sem eles o gráfico emenda 19h com
 * 23h como se fossem vizinhas, e some justamente a informação de que não
 * entrou ninguém naquelas horas.
 */
function serieNoTempo(
  de: string,
  ate: string,
  minutos: number,
  entregues: { criado_em: string }[]
): { hora: string; visitantes: number; vendas: number }[] {
  const passo = minutos * 60_000;
  const inicio = Math.floor(new Date(de).getTime() / passo) * passo;
  const fim = new Date(ate).getTime();

  // Teto de segurança: uma janela enorme com balde pequeno geraria milhares
  // de pontos e travaria o SVG. Nesse caso o chamador escolheu mal, e é
  // melhor um gráfico grosso que uma página que não abre.
  const total = Math.min(Math.ceil((fim - inicio) / passo), 600);

  const visitantes = db
    .prepare(
      `SELECT visitante, criado_em FROM visitas
        WHERE criado_em >= @de AND criado_em < @ate`
    )
    .all({ de, ate }) as { visitante: string; criado_em: string }[];

  const baldes = Array.from({ length: Math.max(total, 1) }, (_, i) => ({
    inicioMs: inicio + i * passo,
    vistos: new Set<string>(),
    vendas: 0,
  }));

  const indice = (iso: string) =>
    Math.floor((new Date(iso).getTime() - inicio) / passo);

  for (const v of visitantes) {
    const i = indice(v.criado_em);
    if (i >= 0 && i < baldes.length) baldes[i].vistos.add(v.visitante);
  }
  for (const p of entregues) {
    const i = indice(p.criado_em);
    if (i >= 0 && i < baldes.length) baldes[i].vendas += 1;
  }

  return baldes.map((b) => ({
    hora: new Date(b.inicioMs).toISOString(),
    visitantes: b.vistos.size,
    vendas: b.vendas,
  }));
}

/** A janela efetiva de uma campanha: `fim` vazio significa "até agora". */
export function janelaDaCampanha(c: Campanha): { de: string; ate: string } {
  return { de: c.inicio, ate: c.fim ?? new Date().toISOString() };
}

/* ── desempenho por peça ─────────────────────────────────────────────────── */

export interface DesempenhoDaPeca {
  peca_id: string | null;
  codigo: string;
  nome: string;
  link: string;
  /** Pessoas distintas que chegaram por esta peça. */
  pessoas: number;
  /** Quantas abriram o funil (responderam ao menos uma pergunta). */
  entraram: number;
  /** Quantas chegaram a ver o preço. */
  viramOferta: number;
  pedidos: number;
  vendas: number;
  receitaCentavos: number;
}

/**
 * O funil de cada vídeo da campanha, lado a lado.
 *
 * ── Por que isto é a métrica que importa ──────────────────────────────────
 *
 * "O Instagram trouxe 40 pessoas" não permite decidir nada. A decisão real é
 * qual vídeo pausar e qual escalar, e para isso o número precisa ser por
 * peça. Uma campanha com três vídeos onde um converte 4% e dois convertem 0%
 * parece, no agregado, uma campanha medíocre de 1,3% — e a leitura certa é
 * "pausa dois, põe todo o dinheiro no terceiro".
 *
 * A linha com `peca_id` nulo é o tráfego que veio pelo link da campanha sem
 * peça (o da bio, tipicamente). Ela não é erro: é uma origem de verdade.
 */
export function desempenhoPorPeca(campanhaId: string): DesempenhoDaPeca[] {
  const campanha = buscarCampanha(campanhaId);
  if (!campanha) return [];

  const pecas = listarPecas(campanhaId);
  const porId = new Map(pecas.map((p) => [p.id, p]));

  const linhas = db
    .prepare(
      `SELECT t.peca_id                          AS peca_id,
              COUNT(DISTINCT t.visitante)        AS pessoas
         FROM toques t
        WHERE t.campanha_id = ? AND t.conta_aquisicao = 1
        GROUP BY t.peca_id`
    )
    .all(campanhaId) as { peca_id: string | null; pessoas: number }[];

  const marcos = db
    .prepare(
      `SELECT t.peca_id AS peca_id,
              -- A coluna chama-se "marco", e os nomes convivem em duas
              -- gerações: "cena"/"cta" são do ritual antigo, "ritual_aberto"
              -- e "plano_visto" do funil de anúncio. Aceitar os dois evita um
              -- relatório que zera no dia em que o funil muda de nome.
              COUNT(DISTINCT CASE WHEN m.marco IN ('cena', 'ritual_aberto', 'cta')
                                  THEN m.visitante END) AS entraram,
              COUNT(DISTINCT CASE WHEN m.marco IN ('plano_visto', 'plano_completa',
                                                   'checkout_aberto')
                                  THEN m.visitante END) AS viramOferta
         FROM toques t
         LEFT JOIN marcos m ON m.visitante = t.visitante
        WHERE t.campanha_id = ? AND t.conta_aquisicao = 1
        GROUP BY t.peca_id`
    )
    .all(campanhaId) as {
    peca_id: string | null;
    entraram: number;
    viramOferta: number;
  }[];

  const vendas = db
    .prepare(
      `SELECT peca_id,
              COUNT(*) AS pedidos,
              SUM(CASE WHEN status IN ('pago','gerando','entregue') THEN 1 ELSE 0 END) AS vendas
         FROM pedidos
        WHERE campanha_id = ? AND exemplo = 0
        GROUP BY peca_id`
    )
    .all(campanhaId) as {
    peca_id: string | null;
    pedidos: number;
    vendas: number;
  }[];

  // A receita sai de `precoDoPedido` e não de uma soma no SQL: o preço
  // depende do produto e do cupom congelado no pedido, e duplicar essa regra
  // aqui faria o painel divergir do que foi de fato cobrado.
  const pagos = db
    .prepare(
      `SELECT peca_id, produto, desconto_percentual
         FROM pedidos
        WHERE campanha_id = ? AND exemplo = 0
          AND status IN ('pago','gerando','entregue')`
    )
    .all(campanhaId) as {
    peca_id: string | null;
    produto: string;
    desconto_percentual: number | null;
  }[];

  const receita = new Map<string, number>();
  for (const p of pagos) {
    const chave = p.peca_id ?? '';
    receita.set(
      chave,
      (receita.get(chave) ?? 0) + precoDoPedido(p).finalCentavos
    );
  }

  const chaves = new Set<string>([
    ...pecas.map((p) => p.id),
    ...linhas.map((l) => l.peca_id ?? ''),
    ...vendas.map((v) => v.peca_id ?? ''),
  ]);

  return [...chaves]
    .map((chave) => {
      const peca = chave ? porId.get(chave) : undefined;
      const t = linhas.find((l) => (l.peca_id ?? '') === chave);
      const m = marcos.find((x) => (x.peca_id ?? '') === chave);
      const v = vendas.find((x) => (x.peca_id ?? '') === chave);
      return {
        peca_id: peca?.id ?? null,
        codigo: peca?.codigo ?? '—',
        nome: peca?.nome ?? 'Link da campanha (sem peça)',
        link: linkDaPeca(campanha, peca),
        pessoas: t?.pessoas ?? 0,
        entraram: m?.entraram ?? 0,
        viramOferta: m?.viramOferta ?? 0,
        pedidos: v?.pedidos ?? 0,
        vendas: v?.vendas ?? 0,
        receitaCentavos: receita.get(chave) ?? 0,
      };
    })
    .sort((a, b) => b.vendas - a.vendas || b.pessoas - a.pessoas);
}
