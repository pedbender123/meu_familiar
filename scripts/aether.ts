import { carregarEnv } from '../src/lib/carregar-env';
carregarEnv();

import WebSocket from 'ws';
import Database from 'better-sqlite3';
import { BANCO } from '../src/lib/caminhos';
import { desde, type Janela, ehJanela } from '../src/lib/analitica';
import { listarCampanhas, desempenhoPorPeca, linkDaPeca, listarPecas, buscarCampanha } from '../src/lib/campanhas';
import { resumoDeToques, vendasPorAtribuicao, jornadaLegivel } from '../src/lib/toques';
import { precoDoPedido } from '../src/lib/cupons';

/**
 * A ponte com o Petrus (AetherOS), pelo protocolo do `AETHER_LINK.md`.
 *
 * ── Por que processo separado e não dentro do Next ────────────────────────
 *
 * A conexão é um WebSocket de vida longa que precisa reconectar sozinho. O
 * Next reinicia workers, e um socket preso a um worker morre com ele — o
 * projeto apareceria offline no Petrus sem ninguém perceber. Aqui é um pm2
 * próprio: cai, volta, e a queda fica visível no `pm2 list`.
 *
 * ── Só leitura ────────────────────────────────────────────────────────────
 *
 * As ações consultam. Nenhuma cria campanha, muda preço, envia e-mail ou
 * mexe em pedido — um erro de interpretação do modelo do outro lado não pode
 * virar dinheiro cobrado errado ou e-mail disparado para cliente. Se um dia
 * fizer sentido escrever por aqui, que seja uma decisão consciente e com
 * confirmação, não um efeito colateral de uma pergunta mal formulada.
 *
 * Uso:  npm run aether
 * pm2:  pm2 start npm --name bruxario-aether -- run aether
 */
const URL_AETHER = process.env.AETHER_URL || 'ws://127.0.0.1:8000/ws/projects';
const TOKEN = process.env.AETHER_LINK_TOKEN;

const db = new Database(BANCO, { readonly: true });

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

const ACOES = [
  {
    name: 'campanhas',
    description:
      'Lista as campanhas com investimento, vendas, receita e retorno. Use para "como estão as campanhas", "quanto gastei em anúncio", "qual campanha deu lucro".',
    params: {},
  },
  {
    name: 'campanha_detalhe',
    description:
      'O desempenho vídeo a vídeo de uma campanha: quantas pessoas cada peça trouxe, quantas compraram e o link de cada uma. Use para "qual vídeo está convertendo", "qual criativo pausar".',
    params: { nome_ou_codigo: 'string — nome da campanha ou o código de 2 letras' },
  },
  {
    name: 'vendas',
    description:
      'Vendas e receita numa janela, com o método de pagamento. Use para "quanto vendi hoje", "receita dos últimos 7 dias".',
    params: { janela: 'string — hoje, 7d, 30d, 90d ou tudo (padrão 30d)' },
  },
  {
    name: 'rastreio',
    description:
      'De onde as pessoas vieram e a quem as vendas foram creditadas, separando aquisição de retorno. Use para "de onde vem meu tráfego", "o remarketing está funcionando".',
    params: { janela: 'string — hoje, 7d, 30d, 90d ou tudo (padrão 30d)' },
  },
  {
    name: 'funil',
    description:
      'Onde as pessoas desistem: chegaram, entraram no ritual, viram o preço, pagaram. Use para "onde estou perdendo gente".',
    params: { janela: 'string — hoje, 7d, 30d, 90d ou tudo (padrão 30d)' },
  },
  {
    name: 'jornada',
    description:
      'Por onde uma pessoa específica passou, do primeiro toque à compra. Use para "por onde veio a fulana", "essa venda veio de qual vídeo".',
    params: { pessoa: 'string — e-mail, nome ou id do pedido' },
  },
  {
    name: 'saude',
    description:
      'Estado do sistema: pedidos travados, entregas pendentes, últimos erros. Use para "está tudo certo", "tem pedido preso".',
    params: {},
  },
];

function janelaDe(params: Record<string, unknown>): { janela: Janela; corte: string | null } {
  const bruta = String(params?.janela ?? '30d');
  const janela: Janela = ehJanela(bruta) ? bruta : '30d';
  return { janela, corte: desde(janela) };
}

function executar(acao: string, params: Record<string, unknown>): string {
  switch (acao) {
    case 'campanhas':
      return acaoCampanhas();
    case 'campanha_detalhe':
      return acaoCampanhaDetalhe(String(params?.nome_ou_codigo ?? ''));
    case 'vendas':
      return acaoVendas(janelaDe(params));
    case 'rastreio':
      return acaoRastreio(janelaDe(params));
    case 'funil':
      return acaoFunil(janelaDe(params));
    case 'jornada':
      return acaoJornada(String(params?.pessoa ?? ''));
    case 'saude':
      return acaoSaude();
    default:
      return `Ação desconhecida: ${acao}`;
  }
}

function acaoCampanhas(): string {
  const campanhas = listarCampanhas();
  if (campanhas.length === 0) return 'Nenhuma campanha cadastrada.';

  const linhas = campanhas.map((c) => {
    const pedidos = db
      .prepare(
        `SELECT produto, desconto_percentual, status
           FROM pedidos WHERE campanha_id = ? AND exemplo = 0`
      )
      .all(c.id) as { produto: string; desconto_percentual: number | null; status: string }[];

    const pagos = pedidos.filter((p) =>
      ['pago', 'gerando', 'entregue'].includes(p.status)
    );
    const receita = pagos.reduce((s, p) => s + precoDoPedido(p).finalCentavos, 0);
    const lucro = receita - c.investido_centavos;
    const codigo = c.codigo ? `?c=${c.codigo}` : 'sem código';

    return `• ${c.nome} (${codigo}) — investido ${brl(c.investido_centavos)}, ${pagos.length} venda(s), receita ${brl(receita)}, resultado ${lucro >= 0 ? '+' : ''}${brl(lucro)}`;
  });

  return `${campanhas.length} campanha(s):\n${linhas.join('\n')}`;
}

function acaoCampanhaDetalhe(termo: string): string {
  if (!termo) return 'Diga o nome ou o código da campanha.';
  const c =
    listarCampanhas().find(
      (x) =>
        x.codigo === termo.toLowerCase() ||
        x.nome.toLowerCase().includes(termo.toLowerCase())
    ) ?? null;
  if (!c) return `Nenhuma campanha com "${termo}".`;

  const pecas = desempenhoPorPeca(c.id);
  if (pecas.length === 0) {
    const cadastradas = listarPecas(c.id);
    return cadastradas.length === 0
      ? `A campanha "${c.nome}" não tem peças cadastradas. O link geral dela é ${linkDaPeca(c)}.`
      : `A campanha "${c.nome}" tem ${cadastradas.length} peça(s) cadastrada(s), mas nenhuma recebeu tráfego ainda.`;
  }

  const linhas = pecas.map(
    (p) =>
      `• ${p.codigo} ${p.nome}: ${p.pessoas} pessoa(s), ${p.entraram} entraram, ${p.viramOferta} viram preço, ${p.vendas} venda(s), receita ${brl(p.receitaCentavos)} — ${p.link}`
  );
  return `Campanha "${c.nome}" (investido ${brl(c.investido_centavos)}):\n${linhas.join('\n')}`;
}

function acaoVendas({ janela, corte }: { janela: Janela; corte: string | null }): string {
  const filtro = corte ? 'AND criado_em >= ?' : '';
  const args = corte ? [corte] : [];

  const pedidos = db
    .prepare(
      `SELECT produto, desconto_percentual, status, metodo_pagamento
         FROM pedidos WHERE exemplo = 0 ${filtro}`
    )
    .all(...args) as {
    produto: string;
    desconto_percentual: number | null;
    status: string;
    metodo_pagamento: string | null;
  }[];

  const pagos = pedidos.filter((p) => ['pago', 'gerando', 'entregue'].includes(p.status));
  const receita = pagos.reduce((s, p) => s + precoDoPedido(p).finalCentavos, 0);

  const metodos = new Map<string, number>();
  for (const p of pagos) {
    const m = p.metodo_pagamento ?? 'não informado';
    metodos.set(m, (metodos.get(m) ?? 0) + 1);
  }
  const porMetodo = [...metodos]
    .map(([m, n]) => `${m}: ${n}`)
    .join(', ');

  return [
    `Janela ${janela}: ${pedidos.length} pedido(s), ${pagos.length} pago(s), receita ${brl(receita)}.`,
    pagos.length > 0 ? `Ticket médio ${brl(Math.round(receita / pagos.length))}.` : '',
    porMetodo ? `Pagamento — ${porMetodo}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function acaoRastreio({ janela, corte }: { janela: Janela; corte: string | null }): string {
  const toques = resumoDeToques(corte);
  const atrib = vendasPorAtribuicao(corte);

  const canais = toques
    .map((t) => `${t.tipo}: ${t.aquisicoes} aquisição(ões), ${t.retornos} retorno(s), ${t.pessoas} pessoa(s)`)
    .join('\n• ');

  const creditos = atrib
    .filter((a) => a.vendas > 0)
    .map((a) => `${a.atribuicao}${a.origem ? ` (${a.origem})` : ''}: ${a.vendas} venda(s)`)
    .join('\n• ');

  return [
    `Janela ${janela}.`,
    canais ? `\nChegadas:\n• ${canais}` : '\nNenhuma chegada registrada.',
    creditos ? `\n\nVendas creditadas a:\n• ${creditos}` : '\n\nNenhuma venda nesta janela.',
  ].join('');
}

function acaoFunil({ janela, corte }: { janela: Janela; corte: string | null }): string {
  const filtro = corte ? 'WHERE criado_em >= ?' : '';
  const args = corte ? [corte] : [];

  const chegaram = (
    db
      .prepare(`SELECT COUNT(DISTINCT visitante) n FROM visitas ${filtro}`)
      .get(...args) as { n: number }
  ).n;

  // Os nomes convivem em duas gerações do funil — ver a nota em
  // `desempenhoPorPeca`. Contar só os novos zeraria o histórico.
  const marco = (...nomes: string[]) =>
    (
      db
        .prepare(
          `SELECT COUNT(DISTINCT visitante) n FROM marcos
            WHERE marco IN (${nomes.map(() => '?').join(',')})
            ${corte ? 'AND criado_em >= ?' : ''}`
        )
        .get(...nomes, ...args) as { n: number }
    ).n;

  const entraram = marco('ritual_aberto', 'cena', 'cta');
  const viramPreco = marco('plano_visto', 'plano_completa', 'checkout_aberto');
  const checkout = marco('pagamento_aberto');

  const pagos = (
    db
      .prepare(
        `SELECT COUNT(*) n FROM pedidos
          WHERE exemplo = 0 AND status IN ('pago','gerando','entregue')
          ${corte ? 'AND criado_em >= ?' : ''}`
      )
      .get(...args) as { n: number }
  ).n;

  const passo = (de: number, para: number) =>
    de > 0 ? ` (${((para / de) * 100).toFixed(0)}%)` : '';

  return [
    `Funil na janela ${janela}:`,
    `• Chegaram: ${chegaram}`,
    `• Abriram o ritual: ${entraram}${passo(chegaram, entraram)}`,
    `• Viram o preço: ${viramPreco}${passo(entraram, viramPreco)}`,
    `• Foram ao checkout: ${checkout}${passo(viramPreco, checkout)}`,
    `• Pagaram: ${pagos}${passo(checkout, pagos)}`,
  ].join('\n');
}

function acaoJornada(termo: string): string {
  if (!termo) return 'Diga o e-mail, o nome ou o id do pedido.';
  const alvo = `%${termo.toLowerCase()}%`;
  const p = db
    .prepare(
      `SELECT id, nome, email, visitante, status, origem, atribuicao
         FROM pedidos
        WHERE lower(email) LIKE ? OR lower(nome) LIKE ? OR id = ?
        ORDER BY criado_em DESC LIMIT 1`
    )
    .get(alvo, alvo, termo) as
    | {
        id: string;
        nome: string;
        email: string;
        visitante: string | null;
        status: string;
        origem: string | null;
        atribuicao: string | null;
      }
    | undefined;

  if (!p) return `Ninguém encontrado com "${termo}".`;
  if (!p.visitante) {
    return `${p.nome} (${p.email}) — ${p.status}, origem ${p.origem ?? 'desconhecida'}. Sem jornada registrada: o pedido é anterior ao rastreio por toque.`;
  }

  const passos = jornadaLegivel(p.visitante);
  if (passos.length === 0) {
    return `${p.nome} (${p.email}) — ${p.status}. Nenhum toque registrado.`;
  }

  const linhas = passos.map((s) => {
    const quando = new Date(s.quando).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    return `• ${quando} — ${s.rotulo}${s.conta ? '' : ' (retorno, não conta como aquisição)'}`;
  });

  return [
    `${p.nome} (${p.email}) — ${p.status}, crédito: ${p.atribuicao ?? 'legado'}.`,
    `${passos.length} toque(s):`,
    ...linhas,
  ].join('\n');
}

function acaoSaude(): string {
  const conta = (sql: string, ...args: unknown[]) =>
    (db.prepare(sql).get(...args) as { n: number }).n;

  const pagosSemEntrega = conta(
    `SELECT COUNT(*) n FROM pedidos
      WHERE status IN ('pago','gerando') AND exemplo = 0
        AND pago_em <= datetime('now', '-1 hour')`
  );
  const comErro = conta(`SELECT COUNT(*) n FROM pedidos WHERE status = 'erro'`);
  const semEmail = conta(
    `SELECT COUNT(*) n FROM pedidos
      WHERE email = '' AND status IN ('pago','gerando','entregue')`
  );
  const ritualPendente = conta(
    `SELECT COUNT(*) n FROM pedidos
      WHERE ritual_completo = 0 AND status IN ('pago','gerando') AND exemplo = 0`
  );

  const problemas = [
    pagosSemEntrega > 0 && `${pagosSemEntrega} pedido(s) pago(s) há mais de 1h sem entrega`,
    comErro > 0 && `${comErro} pedido(s) em erro`,
    semEmail > 0 && `${semEmail} venda(s) sem e-mail de entrega`,
    ritualPendente > 0 && `${ritualPendente} pessoa(s) pagaram e não terminaram o ritual`,
  ].filter(Boolean);

  return problemas.length === 0
    ? 'Tudo certo: nenhum pedido travado, em erro ou sem entrega.'
    : `Atenção:\n• ${problemas.join('\n• ')}`;
}

/* ── a conexão ───────────────────────────────────────────────────────────── */

let tentativas = 0;

function conectar() {
  if (!TOKEN) {
    console.error('[aether] AETHER_LINK_TOKEN ausente no .env — nada a fazer.');
    process.exit(1);
  }

  const ws = new WebSocket(URL_AETHER);

  ws.on('open', () => {
    tentativas = 0;
    ws.send(
      JSON.stringify({
        type: 'hello',
        token: TOKEN,
        name: 'Bruxário',
        description:
          'Loja de leituras místicas personalizadas. Consultas de campanha, vendas, rastreio de origem e saúde do sistema.',
        actions: ACOES,
      })
    );
    console.log(`[aether] conectado em ${URL_AETHER}, ${ACOES.length} ações anunciadas`);
  });

  ws.on('message', (bruto) => {
    let msg: { type?: string; request_id?: string; action?: string; params?: Record<string, unknown> };
    try {
      msg = JSON.parse(String(bruto));
    } catch {
      return;
    }
    if (msg.type !== 'invoke' || !msg.request_id) return;

    console.log(`[aether] invoke ${msg.action}`, msg.params ?? {});
    let resultado: string;
    try {
      resultado = executar(msg.action ?? '', msg.params ?? {});
    } catch (erro) {
      // O erro vai como TEXTO em vez de derrubar a conexão: do outro lado o
      // Petrus só espera uma string, e um socket que cai por causa de uma
      // consulta ruim deixa o projeto offline até alguém reparar.
      console.error('[aether] falhou:', erro);
      resultado = `Não consegui responder: ${erro instanceof Error ? erro.message : String(erro)}`;
    }

    ws.send(
      JSON.stringify({
        type: 'invoke_result',
        request_id: msg.request_id,
        result: resultado,
      })
    );
  });

  ws.on('close', (codigo) => {
    if (codigo === 4001) {
      console.error('[aether] token recusado (4001). Confira AETHER_LINK_TOKEN.');
      process.exit(1);
    }
    /**
     * Recuo exponencial com teto de 30s.
     *
     * Sem teto, uma queda longa do AetherOS levaria a espera a horas e o
     * projeto ficaria offline muito depois de o outro lado voltar. Sem recuo,
     * um AetherOS fora do ar viraria centenas de tentativas por minuto.
     */
    const espera = Math.min(30_000, 1000 * 2 ** tentativas++);
    console.warn(`[aether] caiu (${codigo}); reconectando em ${espera / 1000}s`);
    setTimeout(conectar, espera);
  });

  ws.on('error', (erro) => {
    console.error('[aether] erro de socket:', erro.message);
  });
}

conectar();
