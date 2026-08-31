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
   * O `utm_campaign` cru do anúncio — o ID numérico que a Meta preenche.
   *
   * A segunda chave da campanha, e a única que o time de marketing precisa
   * conhecer (ele nem sabe que ela existe: a macro preenche sozinha). Nula
   * nas campanhas cadastradas à mão, que continuam vivendo pelo `codigo`.
   *
   * As duas nunca se traduzem uma na outra. Traduzir é o que faz a mesma
   * campanha aparecer duas vezes no painel de quem compra a mídia.
   */
  utm_campanha: string | null;
  /**
   * Quem cobra as vendas desta campanha.
   *
   * `mercadopago` · `cakto` · `wiven`. Nulo = o padrão do `.env`, que é como
   * toda campanha funcionava antes disto existir.
   *
   * Existe pelo mesmo motivo de `funis`: a campanha é a unidade de decisão do
   * negócio, e escolher em qual conta o dinheiro cai é uma decisão do mesmo
   * tipo que escolher a página de vendas. Nenhuma das duas devia exigir
   * deploy.
   */
  gateway: string | null;
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
  /** Quem cobra as vendas desta campanha. `null` = o padrão do `.env`. */
  gateway?: string | null;
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
      (id, nome, plataforma, codigo, funis, gateway, inicio, fim, investido_centavos,
       alcance_estimado, nota, criado_em, atualizado_em)
     VALUES (@id, @nome, @plataforma, @codigo, @funis, @gateway, @inicio, @fim,
       @investido_centavos, @alcance_estimado, @nota, @agora, @agora)`
  ).run({
    id,
    gateway: null,
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
  /** O `utm_content` cru — o `{{ad.id}}` da Meta. Nula nas peças à mão. */
  utm_conteudo?: string | null;
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

/**
 * Troca o nome da peça, mantendo tudo que aponta para ela.
 *
 * Existe porque as peças passaram a nascer sozinhas do `utm_content`, e o
 * nome com que nascem é o `{{ad.id}}` da Meta — dezessete dígitos. Isso
 * identifica com precisão e não diz nada a quem abre o relatório um mês
 * depois: a régua de um bom nome de peça continua sendo "gata preta olhando
 * pra câmera", não "120248978282210044".
 *
 * O `utm_conteudo` e o `codigo` não se tocam: são as chaves, e são elas que
 * ligam a peça ao anúncio e à URL. Renomear é conforto nosso.
 */
export function renomearPeca(id: string, nome: string): void {
  db.prepare('UPDATE pecas SET nome = ? WHERE id = ?').run(nome, id);
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
  /**
   * ISO do momento em que o dinheiro entrou. `null` = não pagou.
   *
   * Existe separado de `statusPedido` porque "comprou" e "recebeu" são
   * perguntas diferentes: quem pagou há dois minutos está em `gerando`, e
   * contar só `entregue` faria a venda mais recente sumir da lista de quem
   * comprou — justamente a que alguém está procurando quando abre a tela.
   */
  pagoEm: string | null;
  /**
   * Como ela **tentou** pagar, mesmo que não tenha conseguido.
   *
   * ── Por que isto faltava, e por que importa ─────────────────────────────
   *
   * O painel só sabia mostrar o método de quem PAGOU. Quem chegou até a tela
   * de pagamento, escolheu cartão e foi recusado aparecia igualzinho a quem
   * fechou a aba na primeira cena — as duas como "—".
   *
   * São situações opostas. Uma é desinteresse; a outra é alguém que decidiu
   * comprar e o sistema não deixou. A segunda é a mais recuperável que
   * existe, e era invisível.
   */
  metodoTentado: string | null;
  /** O método que de fato aprovou. `pix`, `master`, `visa`... */
  metodoPagamento: string | null;
  /** Quantas vezes ela apertou pagar. 0 = nunca chegou lá. */
  tentativasPagamento: number;
  /** O que o gateway respondeu ao recusar. Diz se o problema é dela ou nosso. */
  motivoRecusa: string | null;
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
  minutosPorBalde = 60,
  /**
   * Quando vem, o relatório passa a contar **só quem chegou marcado com esta
   * campanha** — e não tudo que aconteceu no site na mesma janela de tempo.
   *
   * ── Por que isto precisou existir ───────────────────────────────────────
   *
   * A campanha nasceu como "uma janela de tempo", e naquele momento era o
   * máximo que dava para saber. A consequência é que o relatório dela somava
   * quem digitou o endereço, quem veio do link da bio e quem clicou no
   * anúncio — três coisas com custo completamente diferente.
   *
   * Isso empurra a conversão medida para BAIXO (o denominador cresce com
   * gente que nunca viu o anúncio) e faz o CPA parecer pior do que é. Quem
   * decide escalar ou pausar decidia com esse número.
   *
   * Agora que a atribuição existe de verdade — `?c=` ou os UTMs do anúncio —
   * dá para contar só quem é. O que não trouxe marcação nenhuma continua
   * existindo, na Central e no recorte de tráfego direto.
   */
  campanhaId?: string | null
): RelatorioDoPeriodo {
  const j = { de, ate, campanha: campanhaId ?? null };

  /**
   * Quem pertence a esta campanha.
   *
   * São duas fontes, e as duas são necessárias:
   *
   * - **visitas** marcadas com a campanha — o clique no anúncio
   * - **pedidos** marcados com a campanha — porque a pessoa pode clicar hoje,
   *   voltar amanhã digitando o endereço e só então comprar. A segunda visita
   *   não carrega marcação nenhuma, mas o pedido carrega, herdado do cookie
   *   de atribuição que dura um ano.
   *
   * Contar só pelas visitas perderia exatamente a venda mais valiosa: a de
   * quem pensou antes de comprar.
   */
  const soDaCampanha = campanhaId
    ? `AND visitante IN (
         SELECT visitante FROM visitas
          WHERE campanha_id = @campanha AND criado_em >= @de AND criado_em < @ate
          UNION
         SELECT visitante FROM pedidos
          WHERE campanha_id = @campanha AND visitante IS NOT NULL
            AND criado_em >= @de AND criado_em < @ate
       )`
    : '';

  const visitasLinhas = db
    .prepare(
      `SELECT visitante, count(*) n, min(criado_em) primeira, max(criado_em) ultima,
              max(origem) origem, max(dispositivo) dispositivo
         FROM visitas WHERE criado_em >= @de AND criado_em < @ate ${soDaCampanha}
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
          AND criado_em >= @de AND criado_em < @ate ${soDaCampanha}
        GROUP BY visitante`
    )
    .all(j) as { visitante: string; alto: number }[];
  const mapaCena = new Map(cenaMax.map((c) => [c.visitante, c.alto]));

  const abriram = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT visitante FROM marcos
            WHERE marco = 'ritual_aberto' AND criado_em >= @de AND criado_em < @ate
              ${soDaCampanha}`
        )
        .all(j) as { visitante: string }[]
    ).map((r) => r.visitante)
  );

  const viramOferta = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT visitante FROM marcos
            WHERE marco = 'plano_visto' AND criado_em >= @de AND criado_em < @ate
              ${soDaCampanha}`
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
            WHERE marco = @marco AND criado_em >= @de AND criado_em < @ate
              ${soDaCampanha}`
        )
        .get({ ...j, marco }) as { n: number }
    ).n;

  const rascunhos = db
    .prepare(
      `SELECT visitante, email, cena FROM rascunhos
        WHERE criado_em >= @de AND criado_em < @ate ${soDaCampanha}`
    )
    .all(j) as { visitante: string; email: string; cena: number }[];
  const mapaRascunho = new Map(rascunhos.map((r) => [r.visitante, r]));

  const pedidos = db
    .prepare(
      `SELECT id, visitante, nome, email, familiar, status, produto,
              desconto_percentual, respostas_json, bruto_centavos, taxa_centavos,
              liquido_centavos, custo_ia_centavos, origem, criado_em,
              metodo_tentado, metodo_pagamento, motivo_recusa,
              -- pago_em responde "comprou?"; status responde "recebeu?".
              -- Quem pagou há dois minutos ainda está gerando, e contar só
              -- os entregues esconderia justamente a venda mais recente.
              pago_em, tentativas_pagamento,
              -- Necessário para receitaDoPedido distinguir entrega gratuita
              -- de cobrança sem valor gravado. Sem ela, toda campanha aparece
              -- com receita zero.
              pagamento_id
         FROM pedidos
        WHERE exemplo = 0 AND criado_em >= @de AND criado_em < @ate
          ${campanhaId ? 'AND campanha_id = @campanha' : ''}`
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
    pagamento_id: string | null;
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
    pago_em: string | null;
    tentativas_pagamento: number;
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
    /**
     * Só conta o que entrou de verdade. Entrega gratuita — cupom de 100%,
     * amostra, falha de preço — vale zero, e inflar isso aqui empurra verba
     * de anúncio para o criativo errado.
     */
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
        pagoEm: pedido?.pago_em ?? null,
        metodoTentado: pedido?.metodo_tentado ?? null,
        metodoPagamento: pedido?.metodo_pagamento ?? null,
        tentativasPagamento: pedido?.tentativas_pagamento ?? 0,
        motivoRecusa: pedido?.motivo_recusa ?? null,
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
          AND criado_em >= @de AND criado_em < @ate ${soDaCampanha}
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

/* ── o funil de um vídeo, degrau a degrau ────────────────────────────────── */

export interface DegrauDaPeca {
  rotulo: string;
  pessoas: number;
  /** Quanto sobrou do degrau anterior. `null` no primeiro. */
  retencao: number | null;
}

export interface RedeDaPeca {
  origem: string;
  pessoas: number;
}

export interface FunilDaPeca {
  pecaId: string | null;
  codigo: string;
  nome: string;
  link: string;
  degraus: DegrauDaPeca[];
  redes: RedeDaPeca[];
  vendas: number;
  receitaCentavos: number;
}

/**
 * O funil de UMA peça, aberto degrau a degrau.
 *
 * ── Por que uma tela por vídeo ────────────────────────────────────────────
 *
 * A tabela de `desempenhoPorPeca` responde "qual vídeo vende mais". Esta
 * responde a pergunta seguinte, que é a que muda o criativo: **onde as
 * pessoas deste vídeo desistem**. Um vídeo que traz 200 pessoas e perde 180
 * na primeira cena tem problema de promessa — o anúncio prometeu outra coisa.
 * Um que perde na oferta tem problema de preço. São conclusões opostas, e o
 * agregado não distingue as duas.
 *
 * ── Por que separar por rede ──────────────────────────────────────────────
 *
 * O mesmo criativo rende diferente no Feed do Instagram e no do Facebook, e
 * a Meta distribui sozinha entre os dois. Sem esta quebra, um vídeo que
 * converte bem numa rede e mal na outra aparece como mediano nas duas.
 *
 * ── Uma pessoa conta uma vez por degrau ───────────────────────────────────
 *
 * `COUNT(DISTINCT visitante)` em todos, e não `COUNT(*)`: quem recarregou a
 * página três vezes é uma pessoa, não três. Sem isso a retenção passa de
 * 100% e o gráfico deixa de fazer sentido.
 */
export function funilDaPeca(campanhaId: string, pecaId: string | null): FunilDaPeca | null {
  const campanha = buscarCampanha(campanhaId);
  if (!campanha) return null;

  const peca = pecaId ? listarPecas(campanhaId).find((p) => p.id === pecaId) : undefined;
  if (pecaId && !peca) return null;

  /**
   * O filtro de peça precisa distinguir "esta peça" de "sem peça nenhuma", e
   * `= NULL` não faz isso em SQL. Duas cláusulas, escolhidas aqui.
   */
  const filtro = pecaId ? 't.peca_id = @peca' : 't.peca_id IS NULL';
  const params = pecaId ? { campanha: campanhaId, peca: pecaId } : { campanha: campanhaId };

  const contar = (condicao: string): number => {
    const linha = db
      .prepare(
        `SELECT COUNT(DISTINCT m.visitante) AS n
           FROM toques t
           JOIN marcos m ON m.visitante = t.visitante
          WHERE t.campanha_id = @campanha AND t.conta_aquisicao = 1 AND ${filtro}
            AND ${condicao}`
      )
      .get(params) as { n: number };
    return linha?.n ?? 0;
  };

  const chegaram = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT t.visitante) AS n
           FROM toques t
          WHERE t.campanha_id = @campanha AND t.conta_aquisicao = 1 AND ${filtro}`
      )
      .get(params) as { n: number }
  ).n;

  /**
   * "Terminou as 26" sai da CENA MAIS ALTA, não de um marco próprio.
   *
   * Não existe evento "acabou o ritual" — o que existe é `cena` com o número.
   * `valor >= 26` é o que diz que a pessoa chegou ao fim, e usar `nome_ok`
   * no lugar mediria outra coisa: quem preencheu o nome, que vem depois e
   * perde gente por outro motivo.
   */
  const degrausBrutos: { rotulo: string; pessoas: number }[] = [
    { rotulo: 'Chegaram pelo link', pessoas: chegaram },
    { rotulo: 'Abriram o ritual', pessoas: contar(`m.marco IN ('ritual_aberto', 'cta')`) },
    { rotulo: 'Responderam ao menos 1', pessoas: contar(`m.marco = 'cena'`) },
    { rotulo: 'Terminaram as 26', pessoas: contar(`m.marco = 'cena' AND m.valor >= 26`) },
    { rotulo: 'Viram a oferta', pessoas: contar(`m.marco IN ('plano_visto', 'oferta_simples', 'oferta_completa', 'oferta_mensal')`) },
    { rotulo: 'Abriram o checkout', pessoas: contar(`m.marco = 'checkout_aberto'`) },
  ];

  const vendas = (
    db
      .prepare(
        `SELECT COUNT(*) AS n
           FROM pedidos
          WHERE campanha_id = @campanha AND exemplo = 0
            AND status IN ('pago','gerando','entregue')
            AND ${pecaId ? 'peca_id = @peca' : 'peca_id IS NULL'}`
      )
      .get(params) as { n: number }
  ).n;

  degrausBrutos.push({ rotulo: 'Pagaram', pessoas: vendas });

  const degraus: DegrauDaPeca[] = degrausBrutos.map((d, i) => {
    const anterior = i === 0 ? null : degrausBrutos[i - 1].pessoas;
    return {
      ...d,
      retencao: anterior && anterior > 0 ? (d.pessoas / anterior) * 100 : null,
    };
  });

  /** De qual rede da Meta veio cada pessoa deste vídeo. */
  const redes = db
    .prepare(
      `SELECT COALESCE(t.origem, 'sem origem') AS origem,
              COUNT(DISTINCT t.visitante) AS pessoas
         FROM toques t
        WHERE t.campanha_id = @campanha AND t.conta_aquisicao = 1 AND ${filtro}
        GROUP BY COALESCE(t.origem, 'sem origem')
        ORDER BY pessoas DESC`
    )
    .all(params) as RedeDaPeca[];

  const pagos = db
    .prepare(
      `SELECT produto, desconto_percentual
         FROM pedidos
        WHERE campanha_id = @campanha AND exemplo = 0
          AND status IN ('pago','gerando','entregue')
          AND ${pecaId ? 'peca_id = @peca' : 'peca_id IS NULL'}`
    )
    .all(params) as { produto: string; desconto_percentual: number | null }[];

  const receitaCentavos = pagos.reduce((s, p) => s + precoDoPedido(p).finalCentavos, 0);

  const base = process.env.BASE_URL || 'https://bruxario.com.br';
  return {
    pecaId,
    codigo: peca?.codigo ?? '—',
    nome: peca?.nome ?? 'Sem peça (link da bio ou direto)',
    link: peca
      ? `${base}/?c=${campanha.codigo ?? ''}${peca.codigo}`
      : `${base}/?c=${campanha.codigo ?? ''}`,
    degraus,
    redes,
    vendas,
    receitaCentavos,
  };
}

/* ── campanha e peça nascidas do UTM ──────────────────────────────────────
 *
 * Até aqui, campanha e peça só existiam se alguém as cadastrasse no painel e
 * colasse `?c=XXYY` no anúncio. O time que compra a mídia não pensa assim: ele
 * pensa "conectei a UTMify ao Meta, logo está rastreado" — e essa leitura está
 * certa, porque é assim que quase toda página de vendas do mercado funciona.
 *
 * O custo de insistir no nosso dialeto apareceu inteiro numa venda: 27/08,
 * R$ 18,90, criativo identificado no NOSSO painel e invisível no deles.
 *
 * Daqui em diante o link do anúncio carrega só o que a Meta preenche sozinha
 * (`utm_campaign={{campaign.id}}`, `utm_content={{ad.id}}`) e a campanha
 * **nasce** da primeira visita. Ver `docs/PLANO-FLUXO-UTM.md` §3.1.
 */

/**
 * Quantas campanhas o sistema aceita criar sozinho por dia.
 *
 * Sem teto, qualquer um pode chamar `/?utm_campaign=<aleatório>` num laço e
 * encher a tabela — e o painel de campanhas, que é uma tela de decisão, vira
 * uma lista de lixo. Com teto, o pior caso é um dia de ruído que se apaga.
 *
 * O número é folgado de propósito: uma conta de anúncios real não estreia
 * cinquenta campanhas num dia, então ele nunca encosta em uso legítimo.
 */
export const TETO_DE_CAMPANHAS_AUTOMATICAS = 50;

/**
 * O valor de um `utm_*`, reduzido ao que pode virar chave.
 *
 * `null` quando não sobra nada utilizável. Aceita letra, número, ponto, traço
 * e sublinhado — o ID da Meta é só dígito, mas quem escreve UTM à mão usa
 * `promo-agosto`, e recusar isso jogaria fora tráfego bom.
 */
export function chaveDeUtm(bruto: string | null | undefined): string | null {
  if (typeof bruto !== 'string') return null;
  const cru = bruto.trim();

  /*
    A macro não substituída se recusa AQUI, no valor cru, antes de qualquer
    limpeza — a limpeza tira as chaves e `{{campaign.id}}` viraria
    `campaign.id`, um nome perfeitamente válido.

    Isso importa mais do que parece: todo anúncio montado errado manda a mesma
    string literal, então essa campanha fantasma recolheria o tráfego de todos
    eles num balde só — e apareceria no painel como a campanha que mais
    converte, porque seria a soma de várias.
  */
  if (cru.includes('{') || cru.includes('}')) return null;

  const limpo = cru.slice(0, 64).replace(/[^\w.\-]/g, '');
  // Um caractere não identifica nada.
  return limpo.length >= 2 ? limpo : null;
}

function campanhasAutomaticasHoje(): number {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return (
    db
      .prepare(
        `SELECT COUNT(*) c FROM campanhas WHERE utm_campanha IS NOT NULL AND criado_em > ?`
      )
      .get(desde) as { c: number }
  ).c;
}

/**
 * A campanha daquele `utm_campaign` — achando, ou criando na hora.
 *
 * ── Por que criar, em vez de descartar ────────────────────────────────────
 *
 * A alternativa é o dado chegar e ser jogado fora por falta de cadastro
 * prévio, que é exatamente o que vinha acontecendo. **Campanha criada a mais
 * é ruído que se apaga; venda sem campanha é dinheiro que ninguém sabe de
 * onde veio.** Das duas, só uma é recuperável depois.
 *
 * ── Por que o nome nasce sendo o ID ───────────────────────────────────────
 *
 * O ID numérico da Meta identifica; o nome humano é conforto nosso. Quem
 * compra a mídia nunca precisa abrir este painel, então o nome bonito é
 * trabalho de quem quiser fazer — `atualizarCampanha` renomeia sem perder o
 * vínculo, porque a chave é `utm_campanha`, não o nome.
 */
export function campanhaDoUtm(
  utmCampaign: string | null | undefined,
  plataforma?: string | null
): Campanha | undefined {
  const chave = chaveDeUtm(utmCampaign);
  if (!chave) return undefined;

  const existente = db
    .prepare('SELECT * FROM campanhas WHERE utm_campanha = ?')
    .get(chave) as Campanha | undefined;
  if (existente) return existente;

  if (campanhasAutomaticasHoje() >= TETO_DE_CAMPANHAS_AUTOMATICAS) {
    console.error(
      `[campanhas] teto de ${TETO_DE_CAMPANHAS_AUTOMATICAS} criações automáticas ` +
        `em 24 h atingido — "${chave}" não virou campanha. O tráfego continua ` +
        'sendo medido, só não ganha campanha própria.'
    );
    return undefined;
  }

  const id = randomUUID();
  const agora = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO campanhas
         (id, nome, plataforma, codigo, funis, gateway, utm_campanha,
          inicio, fim, investido_centavos, alcance_estimado, nota,
          criado_em, atualizado_em)
       VALUES (@id, @nome, @plataforma, NULL, NULL, NULL, @utm,
               @agora, NULL, 0, NULL, @nota, @agora, @agora)`
    ).run({
      id,
      nome: chave,
      plataforma: plataforma ?? null,
      utm: chave,
      agora,
      nota: 'Criada sozinha a partir do utm_campaign do anúncio. Pode renomear.',
    });
  } catch {
    /*
      Duas visitas do mesmo anúncio no mesmo instante disputam o INSERT; o
      índice único deixa uma passar. A perdedora relê em vez de estourar —
      criar campanha não pode derrubar a visita de quem está comprando.
    */
    return db.prepare('SELECT * FROM campanhas WHERE utm_campanha = ?').get(chave) as
      | Campanha
      | undefined;
  }

  return db.prepare('SELECT * FROM campanhas WHERE id = ?').get(id) as Campanha | undefined;
}

/**
 * A peça daquele `utm_content` — o criativo, o vídeo, o anúncio.
 *
 * É o que destrava a dash por vídeo sem exigir nada de quem sobe o anúncio: o
 * `{{ad.id}}` já vem preenchido pela Meta em toda entrega.
 *
 * `codigo` continua sendo o par de dígitos de sempre, porque ele é o que cabe
 * na URL curta do `?c=`; o `utm_conteudo` é a chave de verdade.
 */
export function pecaDoUtm(
  campanhaId: string,
  utmContent: string | null | undefined
): Peca | undefined {
  const chave = chaveDeUtm(utmContent);
  if (!chave) return undefined;

  const existente = db
    .prepare('SELECT * FROM pecas WHERE campanha_id = ? AND utm_conteudo = ?')
    .get(campanhaId, chave) as Peca | undefined;
  if (existente) return existente;

  const criada = criarPeca({
    campanha_id: campanhaId,
    nome: chave,
    nota: 'Criada sozinha a partir do utm_content do anúncio. Pode renomear.',
  });
  // 99 peças numa campanha só: o tráfego segue atribuído à campanha, que é a
  // parte que decide dinheiro. Perder o recorte por criativo é aceitável.
  if (!criada.ok) return undefined;

  try {
    db.prepare('UPDATE pecas SET utm_conteudo = ? WHERE id = ?').run(chave, criada.id);
  } catch {
    return db.prepare('SELECT * FROM pecas WHERE campanha_id = ? AND utm_conteudo = ?').get(
      campanhaId,
      chave
    ) as Peca | undefined;
  }

  return db.prepare('SELECT * FROM pecas WHERE id = ?').get(criada.id) as Peca | undefined;
}
