import db from '../../lib/db';
import { GERACAO_MORTA_APOS_MS } from '../../lib/processar';
import { gatewayDe } from '../checkouts/gateway';
import { NOMES_DE_GATEWAY, ROTULO_DO_GATEWAY, type NomeDoGateway } from '../checkouts/nomes';
import { segundosAteVoltar, ultimaMedicaoDe } from '../checkouts/saude';
import { sondarWiven, wivenConfigurada, tokensDoWebhook } from '../checkouts/wiven';
import type { Estado, GrupoDeSinais, Sinal } from './tipos';

/**
 * Os sinais vitais do fluxo: cobrança, entrega, rastreio, relatório e contas.
 *
 * ── A régua ───────────────────────────────────────────────────────────────
 *
 * Nas duas semanas de agosto, cinco falhas foram descobertas do mesmo jeito:
 * o dono estranhou um número. A Wiven fora do ar por 26h, a venda que entrou
 * na UTMify como direta, o split contado como taxa, o pixel vazio, e depois o
 * mesmo pixel contando 17 vendas onde havia 5.
 *
 * O sistema **já sabia** de quase todas — o `403` estava no log, o `taxa=1257`
 * estava gravado no banco. A informação existia e não tinha para onde ir.
 * Cada função aqui é uma dessas cinco virada pergunta que o computador
 * responde sozinho. Ver `docs/PLANO-PAINEL-DE-SAUDE.md`.
 *
 * ── Separação de propósito ────────────────────────────────────────────────
 *
 * `colher()` toca banco, ambiente e relógio. `julgar()` é pura. É essa linha
 * que deixa os limiares serem testados sem montar um banco — e limiar sem
 * teste é como um alarme se torna barulho.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Depois de pago, quanto tempo até a entrega virar atraso. */
export const ENTREGA_ATRASADA_APOS_MS = 15 * 60 * 1000;

/**
 * Acima disto, o "custo de gateway" deixou de ser plausível.
 *
 * O número existe por um caso concreto: uma venda de R$ 18,90 apareceu com
 * `taxa=1257` — 66% — porque o repasse do split estava sendo somado à taxa.
 * Nenhum gateway do mercado cobra isso, e um computador sabe disso.
 */
export const TAXA_IMPLAUSIVEL_PCT = 30;

/** Acima disto, o rastreio parou de chegar e a campanha está cega. */
export const SEM_RASTREIO_PCT = 50;

export interface Leitura {
  agora: number;
  gatewayPix: NomeDoGateway;
  gatewayCartao: NomeDoGateway;
  medicaoWiven: { ok: boolean; motivo: string; em: number } | null;
  quarentena: { nome: NomeDoGateway; segundos: number }[];
  /** Pedidos das últimas 24h em que alguém tentou pagar. */
  tentativas24h: number;
  /** Destes, quantos chegaram a ter cobrança criada no gateway. */
  comCobranca24h: number;
  pagos24h: number;
  pagosSemCampanha24h: number;
  pagosSemUtm24h: number;
  entregasAtrasadas: number;
  travadosGerando: number;
  /** Quando a última venda foi confirmada. `null` = nunca houve. */
  ultimoPagamentoEm: number | null;
  taxasImplausiveis: { id: string; pct: number }[];
  splitsQueNaoFecham: string[];
  env: {
    utmifyToken: boolean;
    utmifyPixel: boolean;
    metaPixel: boolean;
    wivenChaves: boolean;
    wivenWebhookToken: boolean;
  };
  /** `null` quando não deu para descobrir o IP de saída. */
  ipAtual: string | null;
  ipAutorizado: string | null;
}

/* ── medir ────────────────────────────────────────────────────────────────*/

function um(sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...args) as { c: number }).c;
}

/**
 * O IP de saída da máquina, cacheado por uma hora.
 *
 * Por que vale uma chamada externa: a chave da Wiven tem lista de IPs
 * autorizados, e o dia em que a VPS mudar de IP a cobrança para com 403 sem
 * nenhum aviso — é a falha mais silenciosa da lista inteira. Uma hora de
 * cache torna o custo desprezível, e falhar aqui vira `desconhecido`, nunca
 * vermelho: rede instável não é problema de configuração.
 */
let ipCache: { valor: string | null; em: number } = { valor: null, em: 0 };
const VALIDADE_DO_IP_MS = 60 * 60 * 1000;

async function ipDeSaida(agora: number): Promise<string | null> {
  if (ipCache.valor && agora - ipCache.em < VALIDADE_DO_IP_MS) return ipCache.valor;
  try {
    const r = await fetch('https://api.ipify.org?format=json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const { ip } = (await r.json()) as { ip?: string };
    if (!ip) return null;
    ipCache = { valor: ip, em: agora };
    return ip;
  } catch {
    return null;
  }
}

export async function colher(agora = Date.now()): Promise<Leitura> {
  /*
    Sonda a Wiven ao abrir a tela. Ela tem cache próprio de 60s, então abrir
    a página dez vezes não vira dez chamadas — o que importa, porque excesso
    de chamada já disparou a proteção antiautomação deles uma vez.
  */
  await sondarWiven(agora).catch(() => {});

  const desde = new Date(agora - DIA_MS).toISOString();
  const limiteEntrega = new Date(agora - ENTREGA_ATRASADA_APOS_MS).toISOString();
  const limiteGeracao = new Date(agora - GERACAO_MORTA_APOS_MS).toISOString();

  /*
    `exemplo = 1` são as amostras nossas do mural, não clientes. Contá-las
    aqui faria a tela de saúde medir a nossa própria mão.
  */
  const real = 'exemplo = 0';

  const taxas = db
    .prepare(
      `SELECT id, bruto_centavos, taxa_centavos FROM pedidos
        WHERE ${real} AND pago_em > ? AND bruto_centavos > 0 AND taxa_centavos IS NOT NULL
          AND taxa_centavos * 100 > bruto_centavos * ?`
    )
    .all(desde, TAXA_IMPLAUSIVEL_PCT) as {
    id: string;
    bruto_centavos: number;
    taxa_centavos: number;
  }[];

  /*
    Bruto − taxa − split tem que dar o líquido. Quando não dá, uma das três
    parcelas foi gravada com o significado de outra — foi exatamente o que
    aconteceu quando o repasse entrou como taxa.
  */
  const splits = db
    .prepare(
      `SELECT id FROM pedidos
        WHERE ${real} AND pago_em > ? AND bruto_centavos IS NOT NULL
          AND taxa_centavos IS NOT NULL AND liquido_centavos IS NOT NULL
          AND bruto_centavos - taxa_centavos - COALESCE(split_centavos, 0) <> liquido_centavos`
    )
    .all(desde) as { id: string }[];

  const ultimo = db
    .prepare(`SELECT MAX(pago_em) AS q FROM pedidos WHERE ${real} AND pago_em IS NOT NULL`)
    .get() as { q: string | null };

  return {
    agora,
    gatewayPix: gatewayDe('pix'),
    gatewayCartao: gatewayDe('cartao'),
    medicaoWiven: ultimaMedicaoDe('wiven'),
    quarentena: NOMES_DE_GATEWAY.map((n) => ({ nome: n, segundos: segundosAteVoltar(n, agora) ?? 0 })).filter(
      (q) => q.segundos > 0
    ),
    tentativas24h: um(
      `SELECT COUNT(*) c FROM pedidos WHERE ${real} AND criado_em > ? AND tentativas_pagamento > 0`,
      desde
    ),
    comCobranca24h: um(
      `SELECT COUNT(*) c FROM pedidos WHERE ${real} AND criado_em > ? AND tentativas_pagamento > 0 AND pagamento_id IS NOT NULL`,
      desde
    ),
    pagos24h: um(`SELECT COUNT(*) c FROM pedidos WHERE ${real} AND pago_em > ?`, desde),
    pagosSemCampanha24h: um(
      `SELECT COUNT(*) c FROM pedidos WHERE ${real} AND pago_em > ? AND campanha_id IS NULL`,
      desde
    ),
    pagosSemUtm24h: um(
      `SELECT COUNT(*) c FROM pedidos WHERE ${real} AND pago_em > ? AND (utm_json IS NULL OR utm_json = '')`,
      desde
    ),
    entregasAtrasadas: um(
      `SELECT COUNT(*) c FROM pedidos
        WHERE ${real} AND pago_em IS NOT NULL AND pago_em < ?
          AND status NOT IN ('entregue', 'estornado')`,
      limiteEntrega
    ),
    travadosGerando: um(
      `SELECT COUNT(*) c FROM pedidos WHERE ${real} AND status = 'gerando' AND atualizado_em < ?`,
      limiteGeracao
    ),
    ultimoPagamentoEm: ultimo.q ? Date.parse(ultimo.q) : null,
    taxasImplausiveis: taxas.map((t) => ({
      id: t.id,
      pct: Math.round((t.taxa_centavos / t.bruto_centavos) * 100),
    })),
    splitsQueNaoFecham: splits.map((s) => s.id),
    env: {
      utmifyToken: !!process.env.UTMIFY_API_TOKEN?.trim(),
      utmifyPixel: !!process.env.NEXT_PUBLIC_UTMIFY_PIXEL_ID?.trim(),
      metaPixel: !!process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim(),
      wivenChaves: wivenConfigurada(),
      wivenWebhookToken: tokensDoWebhook().length > 0,
    },
    ipAtual: await ipDeSaida(agora),
    ipAutorizado: process.env.IP_AUTORIZADO?.trim() || null,
  };
}

/* ── julgar ───────────────────────────────────────────────────────────────*/

/** "há 3 min", "há 2 h". Precisão de relógio de parede basta aqui. */
export function haQuanto(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 100);
}

function cobranca(l: Leitura): GrupoDeSinais {
  const sinais: Sinal[] = [
    {
      nome: 'Quem está cobrando',
      estado: 'ok',
      valor: `Pix: ${ROTULO_DO_GATEWAY[l.gatewayPix]} · Cartão: ${ROTULO_DO_GATEWAY[l.gatewayCartao]}`,
    },
  ];

  const usaWiven = l.gatewayPix === 'wiven' || l.gatewayCartao === 'wiven';
  if (!l.env.wivenChaves) {
    sinais.push({
      nome: 'Wiven responde',
      estado: usaWiven ? 'quebrado' : 'desconhecido',
      valor: 'sem credenciais nesta máquina',
      oQueFazer: usaWiven
        ? 'O roteador manda para a Wiven e ela não tem chave: preencha WIVEN_PUBLIC_KEY e WIVEN_SECRET_KEY no .env e reinicie.'
        : 'Nada roteia para a Wiven aqui, então não há o que medir.',
    });
  } else if (!l.medicaoWiven) {
    sinais.push({
      nome: 'Wiven responde',
      estado: 'desconhecido',
      valor: 'ainda não medida',
      oQueFazer: 'A sonda roda ao abrir esta tela. Recarregue em um minuto.',
    });
  } else if (l.medicaoWiven.ok) {
    sinais.push({
      nome: 'Wiven responde',
      estado: 'ok',
      valor: `medida ${haQuanto(l.agora - l.medicaoWiven.em)}`,
    });
  } else {
    sinais.push({
      nome: 'Wiven responde',
      estado: 'quebrado',
      valor: `${l.medicaoWiven.motivo} (${haQuanto(l.agora - l.medicaoWiven.em)})`,
      /*
        403 aqui já significou duas coisas diferentes: chave errada e proteção
        antiautomação por excesso de chamadas. As duas se resolvem no painel
        deles, e nenhuma se resolve tentando de novo mais rápido.
      */
      oQueFazer:
        'As cobranças já estão indo para o Mercado Pago sozinhas. Se for 401/403, confira as chaves e a lista de IPs autorizados no painel da Wiven — e não fique recarregando, excesso de chamada foi o que derrubou a conta em 24/08.',
    });
  }

  sinais.push(
    l.quarentena.length === 0
      ? { nome: 'Disjuntor', estado: 'ok', valor: 'nenhum gateway de castigo' }
      : {
          nome: 'Disjuntor',
          estado: 'atencao',
          valor: l.quarentena.map((q) => `${ROTULO_DO_GATEWAY[q.nome]} volta em ${q.segundos}s`).join(' · '),
          oQueFazer:
            'Isto é o sistema se protegendo, não uma falha nova: o gateway falhou e as cobranças foram para o padrão. Só vira problema se repetir.',
        }
  );

  if (l.tentativas24h === 0) {
    sinais.push({
      nome: 'Cobrança criada',
      estado: 'desconhecido',
      valor: 'ninguém tentou pagar em 24 h',
    });
  } else if (l.comCobranca24h === 0) {
    sinais.push({
      nome: 'Cobrança criada',
      estado: 'quebrado',
      valor: `0 de ${l.tentativas24h} tentativas viraram cobrança`,
      oQueFazer:
        'Gente tentou pagar e nenhuma cobrança nasceu no gateway. Veja o log do processo (pm2 logs) — quase sempre é credencial recusada.',
    });
  } else {
    sinais.push({
      nome: 'Cobrança criada',
      estado: 'ok',
      valor: `${l.comCobranca24h} de ${l.tentativas24h} tentativas em 24 h`,
    });
  }

  return {
    titulo: 'Cobrança',
    nota: 'Se isto cai, ninguém consegue pagar — e é a única falha que o cliente percebe antes de nós.',
    sinais,
  };
}

function entrega(l: Leitura): GrupoDeSinais {
  const sinais: Sinal[] = [
    l.entregasAtrasadas === 0
      ? { nome: 'Pagou e recebeu', estado: 'ok', valor: 'ninguém esperando' }
      : {
          nome: 'Pagou e recebeu',
          estado: 'quebrado',
          valor: `${l.entregasAtrasadas} pago(s) há mais de 15 min sem entrega`,
          oQueFazer: 'Abra Pedidos, filtre por pago, e rode `npm run reprocessar` para os que estiverem parados.',
        },
    l.travadosGerando === 0
      ? { nome: 'Geração de leitura', estado: 'ok', valor: 'nenhuma travada' }
      : {
          nome: 'Geração de leitura',
          estado: 'atencao',
          valor: `${l.travadosGerando} parada(s) em "gerando"`,
          oQueFazer: 'A geração morreu no meio. `npm run reprocessar` retoma; se repetir, é cota ou chave da IA.',
        },
  ];

  /*
    O sinal que teria pego as 26 horas de Wiven fora do ar.

    Silêncio de webhook não é prova de silêncio de vendas — é suspeita. Só
    acusa quando alguém TENTOU pagar no período: sem tentativa, zero
    confirmação é o número certo, e pintar isso de vermelho ensinaria a
    ignorar vermelho.
  */
  if (l.tentativas24h === 0) {
    sinais.push({
      nome: 'Confirmação chegando',
      estado: 'desconhecido',
      valor: 'sem tentativa de pagamento em 24 h',
    });
  } else if (l.pagos24h === 0) {
    sinais.push({
      nome: 'Confirmação chegando',
      estado: 'quebrado',
      valor: `${l.tentativas24h} tentativa(s), nenhuma confirmada`,
      oQueFazer:
        'Ou ninguém concluiu o Pix, ou o webhook não está chegando. Confira a URL de retorno no painel do gateway e o WIVEN_WEBHOOK_TOKEN — "token não confere" aparece no pm2 logs quando é isso.',
    });
  } else {
    sinais.push({
      nome: 'Confirmação chegando',
      estado: 'ok',
      valor:
        l.ultimoPagamentoEm === null
          ? `${l.pagos24h} em 24 h`
          : `${l.pagos24h} em 24 h · última ${haQuanto(l.agora - l.ultimoPagamentoEm)}`,
    });
  }

  return {
    titulo: 'Entrega',
    nota: 'Quem pagou tem que receber. Só o webhook libera acesso, então silêncio aqui é sempre suspeito.',
    sinais,
  };
}

function rastreio(l: Leitura): GrupoDeSinais {
  const semCampanha = pct(l.pagosSemCampanha24h, l.pagos24h);
  const semUtm = pct(l.pagosSemUtm24h, l.pagos24h);

  const sinais: Sinal[] =
    l.pagos24h === 0
      ? [
          { nome: 'Vendas com campanha', estado: 'desconhecido', valor: 'sem venda em 24 h' },
          { nome: 'Vendas com UTM', estado: 'desconhecido', valor: 'sem venda em 24 h' },
        ]
      : [
          {
            nome: 'Vendas com campanha',
            estado: semCampanha > SEM_RASTREIO_PCT ? 'atencao' : 'ok',
            valor: `${l.pagos24h - l.pagosSemCampanha24h} de ${l.pagos24h} ligadas a uma campanha`,
            ...(semCampanha > SEM_RASTREIO_PCT
              ? {
                  oQueFazer:
                    'A maioria das vendas não sabe de onde veio. Confira se o link do anúncio ainda carrega o ?c= da campanha.',
                }
              : {}),
          },
          {
            nome: 'Vendas com UTM',
            estado: semUtm > SEM_RASTREIO_PCT ? 'atencao' : 'ok',
            valor: `${l.pagos24h - l.pagosSemUtm24h} de ${l.pagos24h} chegaram com UTM`,
            ...(semUtm > SEM_RASTREIO_PCT
              ? {
                  /*
                    Foi assim que a venda de 27/08 virou "venda direta" dentro
                    da UTMify: o link do anúncio não tinha as macros, então o
                    pedido nasceu sem utm_json e foi relatado fora da campanha.
                  */
                  oQueFazer:
                    'Venda sem UTM entra na UTMify como venda direta, fora da campanha. Peça ao marketing para pôr as macros de UTM no link do anúncio.',
                }
              : {}),
          },
        ];

  sinais.push(
    l.env.utmifyPixel
      ? { nome: 'Pixel da UTMify', estado: 'ok', valor: 'configurado' }
      : {
          nome: 'Pixel da UTMify',
          estado: 'atencao',
          valor: 'NEXT_PUBLIC_UTMIFY_PIXEL_ID vazio',
          oQueFazer: 'Preencha no .env e rode um build novo — variável NEXT_PUBLIC_ só vale depois de build.',
        }
  );

  /*
    O bug das 17 vendas, virado alarme.

    Os dois pixels ligados mandam o MESMO Purchase para o MESMO destino, e o
    contador da Meta infla sem que nada pareça errado em lugar nenhum.
  */
  sinais.push(
    l.env.metaPixel && l.env.utmifyToken
      ? {
          nome: 'Contagem em dobro',
          estado: 'quebrado',
          valor: 'pixel da Meta e UTMify ligados juntos',
          oQueFazer:
            'Os dois mandam o mesmo evento e a Meta conta duas vezes — foi o que fez 5 vendas virarem 17. Escolha um: esvazie NEXT_PUBLIC_META_PIXEL_ID (é quem fala com a Meta hoje é a UTMify) ou desligue o relato para a UTMify.',
        }
      : { nome: 'Contagem em dobro', estado: 'ok', valor: 'só um caminho fala com a Meta' }
  );

  return {
    titulo: 'Rastreio',
    nota: 'De onde veio cada venda. Quando isto quebra, ninguém percebe — a venda acontece e só a atribuição some.',
    sinais,
  };
}

function relatorio(l: Leitura): GrupoDeSinais {
  const sinais: Sinal[] = [
    l.env.utmifyToken
      ? { nome: 'Token da UTMify', estado: 'ok', valor: 'preenchido' }
      : {
          nome: 'Token da UTMify',
          estado: 'quebrado',
          valor: 'UTMIFY_API_TOKEN vazio',
          oQueFazer: 'Sem ele nenhuma venda é relatada e a agência vê zero. Preencha no .env e reinicie.',
        },
    l.taxasImplausiveis.length === 0
      ? { nome: 'Taxa plausível', estado: 'ok', valor: `nenhuma acima de ${TAXA_IMPLAUSIVEL_PCT}%` }
      : {
          nome: 'Taxa plausível',
          estado: 'quebrado',
          valor: l.taxasImplausiveis.map((t) => `${t.id} (${t.pct}%)`).join(', '),
          oQueFazer:
            'Gateway nenhum cobra isso. Quase sempre é repasse de split somado à taxa: confira split_centavos do pedido antes de acreditar no lucro.',
        },
    l.splitsQueNaoFecham.length === 0
      ? { nome: 'Split fecha a conta', estado: 'ok', valor: 'bruto − taxa − split = líquido' }
      : {
          nome: 'Split fecha a conta',
          estado: 'quebrado',
          valor: `${l.splitsQueNaoFecham.length} pedido(s): ${l.splitsQueNaoFecham.slice(0, 5).join(', ')}`,
          oQueFazer:
            'Uma das três parcelas foi gravada com o significado de outra. Compare com a transação no painel do gateway antes de repassar dinheiro.',
        },
  ];

  return {
    titulo: 'Relatório',
    nota: 'O que a agência vê. Errar aqui não quebra nada — só faz todo mundo decidir com número errado.',
    sinais,
  };
}

function contas(l: Leitura): GrupoDeSinais {
  const usaWiven = l.gatewayPix === 'wiven' || l.gatewayCartao === 'wiven';

  const sinais: Sinal[] = [
    l.env.wivenChaves
      ? { nome: 'Credenciais da Wiven', estado: 'ok', valor: 'presentes' }
      : {
          nome: 'Credenciais da Wiven',
          estado: usaWiven ? 'quebrado' : 'desconhecido',
          valor: 'ausentes',
          oQueFazer: usaWiven
            ? 'Preencha WIVEN_PUBLIC_KEY e WIVEN_SECRET_KEY no .env e reinicie.'
            : 'Nada roteia para a Wiven nesta máquina.',
        },
    l.env.wivenWebhookToken
      ? { nome: 'Token do webhook', estado: 'ok', valor: 'configurado' }
      : {
          nome: 'Token do webhook',
          estado: usaWiven ? 'quebrado' : 'desconhecido',
          valor: 'WIVEN_WEBHOOK_TOKEN vazio',
          oQueFazer: usaWiven
            ? 'Sem token o webhook é recusado e ninguém recebe o que pagou. Preencha no .env e reinicie.'
            : 'Só importa quando a Wiven estiver cobrando.',
        },
  ];

  /*
    O mais silencioso da lista. A chave da Wiven só aceita chamada dos IPs
    cadastrados; no dia em que a VPS trocar de IP, a cobrança para com 403 e
    nada avisa antes.
  */
  if (!l.ipAutorizado) {
    sinais.push({
      nome: 'IP autorizado',
      estado: 'desconhecido',
      valor: l.ipAtual ? `saímos por ${l.ipAtual}` : 'não foi possível medir',
      oQueFazer:
        'Ponha IP_AUTORIZADO no .env com o IP que está cadastrado no painel da Wiven, e esta linha passa a avisar antes de a cobrança quebrar.',
    });
  } else if (!l.ipAtual) {
    sinais.push({
      nome: 'IP autorizado',
      estado: 'desconhecido',
      valor: 'não foi possível medir agora',
      oQueFazer: 'Rede instável não é problema de configuração. Se persistir, confira a saída da máquina.',
    });
  } else if (l.ipAtual === l.ipAutorizado) {
    sinais.push({ nome: 'IP autorizado', estado: 'ok', valor: l.ipAtual });
  } else {
    sinais.push({
      nome: 'IP autorizado',
      estado: 'quebrado',
      valor: `saímos por ${l.ipAtual}, cadastrado é ${l.ipAutorizado}`,
      oQueFazer:
        'A Wiven vai recusar com 403 e o checkout para sem aviso. Cadastre o IP novo no painel dela e atualize IP_AUTORIZADO no .env.',
    });
  }

  return {
    titulo: 'Contas e credenciais',
    nota: 'O que expira, muda de dono ou muda de IP sem pedir licença.',
    sinais,
  };
}

/** Puro: mesma leitura, mesmos sinais. É o que torna os limiares testáveis. */
export function julgar(l: Leitura): GrupoDeSinais[] {
  return [cobranca(l), entrega(l), rastreio(l), relatorio(l), contas(l)];
}

export async function sinaisDoSistema(agora = Date.now()): Promise<GrupoDeSinais[]> {
  return julgar(await colher(agora));
}

export type { Estado };

/* ── o resumo, para quem só quer o número ─────────────────────────────────*/

/**
 * Quantos sinais estão ruins — com memória de um minuto.
 *
 * A bolinha no menu aparece em TODA página do painel. Sem esta memória, cada
 * clique numa área qualquer pagaria uma sonda da Wiven e uma consulta de IP:
 * lentidão em toda navegação, e chamada à API da Wiven proporcional a quantas
 * telas alguém abre — que é literalmente o comportamento que derrubou a conta
 * em 24/08.
 *
 * Um minuto de atraso não muda nada: quem vê a bolinha vai abrir a tela, e a
 * tela mede na hora.
 */
let resumoCache: { ruins: number; em: number } | null = null;
const VALIDADE_DO_RESUMO_MS = 60 * 1000;

export async function resumoDaSaude(agora = Date.now()): Promise<number> {
  if (resumoCache && agora - resumoCache.em < VALIDADE_DO_RESUMO_MS) return resumoCache.ruins;

  try {
    const grupos = julgar(await colher(agora));
    const ruins = grupos.reduce(
      (t, g) => t + g.sinais.filter((s) => s.estado === 'quebrado' || s.estado === 'atencao').length,
      0
    );
    resumoCache = { ruins, em: agora };
    return ruins;
  } catch {
    /*
      A saúde do sistema não pode derrubar o painel inteiro. Se a medição
      falhar, o menu fica sem bolinha e a tela de saúde mostra o erro de
      verdade quando alguém abrir.
    */
    return 0;
  }
}

/** Só para os testes. */
export function esquecerResumo(): void {
  resumoCache = null;
}
