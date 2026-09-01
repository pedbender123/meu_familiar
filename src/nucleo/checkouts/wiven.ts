import { randomUUID } from 'node:crypto';
import type {
  DadosCriacao,
  PagamentoResumido,
  ProvedorPagamento,
  ResultadoPagamento,
} from './mercadopago';
import { precoComDesconto } from '../../lib/cupons';
import { ehIndisponibilidade, marcarIndisponivel, marcarDisponivel } from './saude';

/**
 * Wiven — Pix e cartão, cobrança avulsa.
 *
 * ── O que muda em relação à Cakto ─────────────────────────────────────────
 *
 * Duas coisas, e as duas para melhor:
 *
 *   1. **`identifier` é nosso.** String única que a NOSSA aplicação cria e
 *      manda no corpo. Some a gambiarra do `sck`, que era o único campo livre
 *      da Cakto que voltava na consulta.
 *   2. **Valor livre.** O corpo aceita `amount` direto — nada de produto ou
 *      oferta cadastrada. `cakto-ofertas.ts` não tem equivalente aqui.
 *
 * ── E o que muda para pior ────────────────────────────────────────────────
 *
 * O endpoint de cartão recebe **PAN e CVV em texto puro** (`card.number`,
 * `card.cvv`). Hoje, com o Brick do Mercado Pago, o número do cartão nunca
 * toca esta máquina: o navegador tokeniza e manda um `token`. Aqui, não.
 *
 * A decisão do dono (23/08) foi seguir mesmo assim, com passagem direta:
 * os campos atravessam a rota e vão para a Wiven na MESMA requisição —
 * **nunca gravados, nunca em cache, nunca em log, nem no caminho do erro.**
 * É por isso que `montarCorpoCartao` monta o objeto e o devolve sem que ele
 * passe por nenhuma variável de módulo, e que as mensagens de erro daqui
 * nunca ecoam o corpo enviado, só o do gateway.
 *
 * Isso reduz o risco real; **não tira o escopo PCI-DSS**, porque a régua é
 * transmitir ou processar, não armazenar. Está registrado para ser escolha,
 * não surpresa.
 *
 * ── Nasce desligado ───────────────────────────────────────────────────────
 *
 * `gateway.ts` ainda não conhece o nome `wiven`. Enquanto o webhook não
 * estiver escrito e testado, nada roteia para cá — e sem webhook nada
 * libera acesso, que é a regra que não se discute.
 */

const BASE = 'https://app.wiven.com.br/api/v1';

/* ── configuração ─────────────────────────────────────────────────────────*/

export function wivenConfigurada(): boolean {
  return !!process.env.WIVEN_PUBLIC_KEY?.trim() && !!process.env.WIVEN_SECRET_KEY?.trim();
}

function chaves(): { publica: string; secreta: string } {
  const publica = process.env.WIVEN_PUBLIC_KEY?.trim();
  const secreta = process.env.WIVEN_SECRET_KEY?.trim();
  if (!publica || !secreta) {
    throw new Error('[wiven] falta WIVEN_PUBLIC_KEY / WIVEN_SECRET_KEY');
  }
  return { publica, secreta };
}

/** O caminho da nossa rota de webhook. Um lugar só define isto. */
export const CAMINHO_DO_WEBHOOK = '/api/webhook/wiven';

/**
 * Para onde a Wiven avisa que o status mudou. Vai por transação, no corpo.
 *
 * ── Por que não é só `BASE_URL` ───────────────────────────────────────────
 *
 * Em desenvolvimento `BASE_URL` é `http://localhost:3000`, e um `callbackUrl`
 * apontando para localhost é uma cobrança que **nunca vai ser confirmada**: a
 * Wiven bate num endereço que só existe dentro desta máquina, desiste, e o
 * pedido fica em `aguardando_pagamento` para sempre com o dinheiro já pago.
 *
 * Já aconteceu neste projeto — a Cakto ficou com `salesPage` em
 * `http://localhost:3000` porque ninguém checou. Aqui a checagem é do código.
 *
 * `WIVEN_CALLBACK_URL` existe para o caso do túnel (ngrok e afins), quando se
 * quer mesmo receber a notificação na máquina local. Sem ele, endereço local
 * cai no domínio de produção — que é o único alcançável — com aviso no log.
 */
export function urlDeCallback(): string {
  const explicito = process.env.WIVEN_CALLBACK_URL?.trim();
  if (explicito) {
    const limpo = explicito.replace(/\/$/, '');
    /*
      ── Por que a variável perdoa a URL completa ──────────────────────────

      Ela se chama `WIVEN_CALLBACK_URL` e espera só a ORIGEM. Quem lê o nome
      cola a URL do callback — foi exatamente o que aconteceu ao montar o
      ambiente de teste, e o resultado foi
      `.../api/webhook/wiven/api/webhook/wiven`: a Wiven tentou seis vezes,
      levou 404 em todas, e a assinatura ficou paga do lado deles e sem
      confirmação do nosso.

      O sintoma é caro e mudo. Não há erro em lugar nenhum do nosso código —
      só um pagamento que nunca chega, descoberto quando alguém repara que o
      acesso não foi liberado. Aceitar as duas formas custa uma linha.
    */
    return limpo.endsWith(CAMINHO_DO_WEBHOOK) ? limpo : `${limpo}${CAMINHO_DO_WEBHOOK}`;
  }

  const base = (process.env.BASE_URL || 'https://bruxario.com.br').replace(/\/$/, '');

  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(base)) {
    console.warn(
      `[wiven] BASE_URL é ${base} — a Wiven não alcança isso. Usando ` +
        'https://bruxario.com.br. Para receber aqui, exponha a máquina e ' +
        'defina WIVEN_CALLBACK_URL.'
    );
    return `https://bruxario.com.br${CAMINHO_DO_WEBHOOK}`;
  }

  return `${base}${CAMINHO_DO_WEBHOOK}`;
}

/**
 * Fura o cache de borda da Wiven.
 *
 * ── O bug que isto contorna (descoberto em 24/08, com dinheiro real) ──────
 *
 * `GET /gateway/transactions` passa por **CloudFront, e é cacheado**. Medido:
 * `x-cache: Hit from cloudfront`, `age: 511`. Numa rota que responde "esta
 * pessoa pagou?".
 *
 * Pior: a chave do cache inclui o `Accept-Encoding`. O `curl`, que por padrão
 * não pede compressão, recebia `COMPLETED`; o `fetch` do Node, que pede gzip,
 * recebia `PENDING` — **a mesma URL, na mesma máquina, no mesmo segundo,
 * respondendo coisas diferentes**. Um Pix pago há oito minutos aparecia como
 * pendente para o nosso código e como pago para o curl.
 *
 * `Cache-Control: no-cache` foi testado e **é ignorado**. O que funciona é
 * mudar a chave do cache: um parâmetro que nunca se repete garante `Miss`.
 *
 * Só em GET. POST não é cacheado, e sujar o corpo de uma cobrança com
 * parâmetro de conveniência é convite para o gateway recusar.
 */
function furarCache(caminho: string): string {
  const separador = caminho.includes('?') ? '&' : '?';
  return `${caminho}${separador}_=${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

async function chamar(caminho: string, init: RequestInit = {}): Promise<Response> {
  const { publica, secreta } = chaves();
  const ehLeitura = !init.method || init.method.toUpperCase() === 'GET';

  return fetch(`${BASE}${ehLeitura ? furarCache(caminho) : caminho}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-public-key': publica,
      'x-secret-key': secreta,
      ...(init.headers ?? {}),
    },
    // Não resolve o CloudFront, mas impede o cache do próprio Node por cima.
    cache: 'no-store',
    // Compra travada em 40s é compra perdida — o mesmo limite do Mercado Pago.
    signal: AbortSignal.timeout(8000),
  });
}

/* ── sonda de saúde ───────────────────────────────────────────────────────*/

/** Quanto tempo uma sonda vale antes de a próxima ser feita. */
export const VALIDADE_DA_SONDA_MS = 60 * 1000;

/**
 * A sonda é curta de propósito: alguém está esperando a tela de pagamento
 * abrir. Melhor decidir "está fora" em dois segundos e meio e mostrar o
 * Mercado Pago do que segurar o checkout esperando um gateway que talvez
 * nem responda.
 */
const TEMPO_DA_SONDA_MS = 2500;

let sondadaEm = 0;

/**
 * Pergunta à Wiven se ela está de pé, ANTES de a tela de pagamento existir.
 *
 * ── Por que não basta o disjuntor ─────────────────────────────────────────
 *
 * O disjuntor de `saude.ts` é reativo: ele só derruba a chave depois de
 * alguém tentar pagar e falhar. Ou seja, a primeira pessoa depois de uma
 * queda paga o pato — vê um checkout que não cobra.
 *
 * A sonda tira esse custo de cima de quem está comprando. Foi o que faltou em
 * 24/08, quando a Wiven passou 26 horas devolvendo 403 e o checkout teria
 * ficado quebrado esse tempo todo.
 *
 * ── Por que uma por minuto ────────────────────────────────────────────────
 *
 * Sem cache, cada visita à tela de pagamento viraria uma chamada extra à API
 * deles — e foi excesso de chamada que disparou a proteção antiautomação
 * daquele dia. Uma por minuto mantém a informação fresca o bastante e nunca
 * vira rajada, por mais movimento que a campanha traga.
 *
 * Não lança nunca: sonda que derruba a tela de pagamento é pior que gateway
 * fora do ar.
 */
export async function sondarWiven(agora = Date.now()): Promise<void> {
  if (!wivenConfigurada()) return;
  if (agora - sondadaEm < VALIDADE_DA_SONDA_MS) return;
  sondadaEm = agora;

  try {
    const { publica, secreta } = chaves();
    const resposta = await fetch(`${BASE}${furarCache('/gateway/producer/credentials')}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-public-key': publica,
        'x-secret-key': secreta,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(TEMPO_DA_SONDA_MS),
    });

    if (!resposta.ok) {
      marcarIndisponivel('wiven', `sonda: HTTP ${resposta.status}`);
      return;
    }

    /**
     * Resposta 200 que não é JSON também é indisponibilidade.
     *
     * O bloqueio de 24/08 voltava 403, mas um desafio de Cloudflare pode vir
     * como 200 com HTML. Confiar no código de status sozinho deixaria a sonda
     * dizer "está tudo bem" enquanto a cobrança quebra no parse.
     */
    const tipo = resposta.headers.get('content-type') ?? '';
    if (!tipo.includes('json')) {
      marcarIndisponivel('wiven', 'sonda: resposta não é JSON');
      return;
    }

    marcarDisponivel('wiven');
  } catch (erro) {
    marcarIndisponivel('wiven', `sonda: ${String(erro).slice(0, 80)}`);
  }
}

/** Só para os testes: obriga a próxima sonda a acontecer. */
export function esquecerSonda(): void {
  sondadaEm = 0;
}

/* ── dinheiro ─────────────────────────────────────────────────────────────*/

/**
 * A Wiven fala em **reais, número decimal** (`100.5`). O projeto inteiro fala
 * centavos inteiros.
 *
 * O `toFixed(2)` antes do `Number` não é firula: sem ele, um valor vindo de
 * conta com float chegaria como `18.900000000000002` no JSON, e a Wiven
 * recusaria ou cobraria um centavo a mais. Centavo a mais em cobrança é a
 * mesma classe de bug que fez a Completa nascer em 2363.
 */
export function emReais(centavos: number): number {
  return Number((centavos / 100).toFixed(2));
}

/** E a volta: `fee` e `amount` chegam em reais decimais. */
export function emCentavos(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/* ── split ────────────────────────────────────────────────────────────────*/

/**
 * A divisão da venda entre contas Wiven.
 *
 * ── O formato, perguntado à própria API ───────────────────────────────────
 *
 * A documentação do split não estava em mãos, então a forma veio da
 * validação deles: mandar `splits: [{}]` devolve
 *
 *     path: ["splits", 0, "producerId"]  expected: string
 *     path: ["splits", 0, "amount"]      expected: number
 *
 * E `producerId` inexistente devolve "Produtor X não encontrado" — é
 * validado do lado deles, não é campo livre.
 *
 * ── Quem fica com o resto ─────────────────────────────────────────────────
 *
 * O split TIRA da transação e manda para outra conta. O que sobra fica com a
 * conta que cobrou. Então, num acordo de 40/40/20 onde quem cobra é uma das
 * partes, só DUAS entradas são configuradas — a terceira é o resto.
 *
 * Configurar as três faria a soma bater 100% e não sobrar nada para quem
 * recebeu, o que o gateway ou recusa ou executa, e as duas são ruins.
 *
 *     WIVEN_SPLITS=prod_abc:40,prod_xyz:20
 *
 * ── `amount` é VALOR, não percentual ──────────────────────────────────────
 *
 * Em reais, como todo dinheiro nesta API. Nossos preços variam (9,80 · 18,90
 * · 4,90 · 29,90), e valor fixo obrigaria uma linha por produto e um
 * esquecimento a cada preço novo. A porcentagem é convertida aqui.
 *
 * ── Arredondamento para BAIXO, e um teto ──────────────────────────────────
 *
 * `Math.floor`, e a soma nunca passa de 99% do valor. Se os splits somarem
 * mais que a transação, o gateway recusa a COBRANÇA INTEIRA — uma venda
 * perdida por centavo de arredondamento é muito pior que um centavo a menos
 * repassado.
 */
export interface SplitWiven {
  producerId: string;
  amount: number;
}

/** O teto: sempre sobra algo para a conta que cobrou. */
const MAXIMO_REPASSADO = 0.99;

/**
 * A taxa da Wiven, para o split ser calculado sobre o que realmente entra.
 *
 * Faixa de R$ 0–10 mil/mês: **5,99% + R$ 1,99**. Configurável porque a faixa
 * muda com o volume (4,99% + R$ 1,49 até 100 mil), e uma taxa desatualizada
 * aqui vira repasse maior do que o combinado — silenciosamente.
 */
function taxaEstimadaCentavos(precoCentavos: number): number {
  const percentual = Number(process.env.WIVEN_TAXA_PERCENTUAL ?? '5.99');
  const fixaCentavos = Number(process.env.WIVEN_TAXA_FIXA_CENTAVOS ?? '199');
  const pct = Number.isFinite(percentual) ? percentual : 5.99;
  const fixa = Number.isFinite(fixaCentavos) ? fixaCentavos : 199;
  return Math.ceil((precoCentavos * pct) / 100) + fixa;
}

/**
 * Sobre quanto as porcentagens incidem.
 *
 * ── Por que o padrão é o LÍQUIDO ──────────────────────────────────────────
 *
 * Um acordo de 40/40/20 quer dizer que cada um leva sua fatia **do que
 * sobrou**, não do que o cliente pagou. E a diferença aqui é brutal: numa
 * venda de R$ 9,80 a Wiven leva R$ 2,58 — 26%.
 *
 * Calculado sobre o bruto, quem cobra paga a taxa inteira sozinho: mandaria
 * R$ 3,92 + R$ 1,96 aos outros dois e ficaria com R$ 3,92 − R$ 2,58 = R$ 1,34.
 * Os 40% dele viram 14% na prática, e os outros dois recebem cheio.
 *
 * Sobre o líquido, a conta fecha: líquido R$ 7,22, fatias de R$ 2,88 e
 * R$ 1,44 saem como split, e quem cobrou fica com 9,80 − 4,32 − 2,58 =
 * R$ 2,90. Os três levam a fatia combinada, e a taxa é dividida na mesma
 * proporção.
 *
 * `WIVEN_SPLIT_BASE=bruto` volta ao cálculo sobre o valor cheio, para o caso
 * de o acordo ser esse.
 */
function baseDoSplit(precoCentavos: number): number {
  if (process.env.WIVEN_SPLIT_BASE === 'bruto') return precoCentavos;
  return precoCentavos - taxaEstimadaCentavos(precoCentavos);
}

export function splitsDe(precoCentavos: number): SplitWiven[] {
  const bruto = (process.env.WIVEN_SPLITS ?? '').trim();
  if (!bruto || precoCentavos <= 0) return [];

  /**
   * Base não-positiva acontece de verdade: no upgrade de R$ 4,90 a taxa é
   * R$ 2,28 — quase metade. Se um dia o preço ficar abaixo da taxa, dividir
   * um número negativo geraria split negativo, e o gateway recusaria a
   * cobrança. Quem cobrou absorve, e a venda acontece.
   */
  const base = baseDoSplit(precoCentavos);
  if (base <= 0) {
    console.warn(
      `[wiven] sem split em cobrança de ${precoCentavos} centavos: ` +
        'a taxa come o valor inteiro.'
    );
    return [];
  }

  const partes: SplitWiven[] = [];
  let repassadoCentavos = 0;
  // O teto continua sobre o PREÇO, não sobre a base: é o preço que o gateway
  // compara com a soma dos splits ao recusar a cobrança.
  const teto = Math.floor(precoCentavos * MAXIMO_REPASSADO);

  for (const par of bruto.split(',')) {
    const corte = par.lastIndexOf(':');
    if (corte < 1) continue;

    const produtor = par.slice(0, corte).trim();
    const percentual = Number(par.slice(corte + 1));
    if (!produtor) continue;
    if (!Number.isFinite(percentual) || percentual <= 0 || percentual >= 100) continue;

    const centavos = Math.floor((base * percentual) / 100);
    if (centavos <= 0) continue;

    /**
     * O teto é conferido acumulando, não por entrada.
     *
     * Duas linhas de 60% cada passam do total sem que nenhuma delas, sozinha,
     * pareça errada. É o tipo de erro de configuração que só aparece quando a
     * primeira venda de verdade é recusada.
     */
    if (repassadoCentavos + centavos > teto) {
      console.error(
        `[wiven] split de ${produtor} (${percentual}%) ignorado: a soma passaria ` +
          `de ${MAXIMO_REPASSADO * 100}% da transação. Confira WIVEN_SPLITS.`
      );
      continue;
    }

    repassadoCentavos += centavos;
    partes.push({ producerId: produtor, amount: emReais(centavos) });
  }

  return partes;
}

/* ── identificador ────────────────────────────────────────────────────────*/

const SEPARADOR = '--';

/**
 * O `identifier` que vai no corpo.
 *
 * **Não pode ser o `pedidoId` puro.** A Wiven exige um identificador único
 * *por transação*, e uma compra costuma ter mais de uma: cartão recusado e a
 * pessoa tenta outro é o caso normal, não a exceção. Reusar o identificador
 * na segunda tentativa daria conflito, e o sintoma seria uma venda perdida
 * exatamente em quem estava mais decidido a comprar.
 *
 * Então: `pedidoId--<uuid>`. O prefixo é o que o webhook usa para reencontrar
 * o pedido; o sufixo é o que faz cada tentativa ser uma transação nova.
 */
export function identificadorDe(pedidoId: string): string {
  return `${pedidoId}${SEPARADOR}${randomUUID()}`;
}

/**
 * A volta: do `identifier` para o nosso `pedidoId`.
 *
 * Tolerante de propósito — um identificador sem sufixo (feito à mão no painel,
 * ou de uma versão anterior) ainda devolve o pedido em vez de `null`.
 */
export function pedidoDoIdentificador(identifier: string | null | undefined): string | null {
  if (!identifier) return null;
  const corte = identifier.indexOf(SEPARADOR);
  const id = corte === -1 ? identifier : identifier.slice(0, corte);
  return id || null;
}

/* ── tradução ─────────────────────────────────────────────────────────────*/

/** O vocabulário da RESPOSTA DE CRIAÇÃO. */
export type StatusDeCriacao = 'OK' | 'PENDING' | 'FAILED' | 'REJECTED' | 'CANCELED';

/** O vocabulário do WEBHOOK. Não é o mesmo — ver abaixo. */
export type StatusDeWebhook = 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'CHARGED_BACK';

/**
 * Wiven → nosso vocabulário.
 *
 * ── A Wiven fala DOIS idiomas ─────────────────────────────────────────────
 *
 * A resposta de criação devolve `OK · PENDING · FAILED · REJECTED · CANCELED`.
 * O webhook devolve `COMPLETED · PENDING · FAILED · REFUNDED · CHARGED_BACK`.
 * Só `PENDING` e `FAILED` são comuns aos dois.
 *
 * Isto é uma mina. Uma tradução que só conhecesse o vocabulário da criação
 * jamais reconheceria `COMPLETED` — e `COMPLETED` é justamente o que chega
 * quando o dinheiro entra. O sintoma seria o pior possível: todo mundo
 * pagando e ninguém recebendo, com o log dizendo apenas
 * `pagamento_COMPLETED` e seguindo em frente.
 *
 * Por isso os dois idiomas moram na mesma função, e há teste para cada
 * palavra dos dois.
 *
 * `statusLiberaAcesso` continua sendo a única função do projeto que decide se
 * alguém recebe o que comprou, e `webhook-pagamento.ts` não ganha uma linha
 * sobre Wiven.
 */
export function traduzirStatus(status: string | undefined): string {
  switch (status) {
    // criação: autorizado. webhook: pago.
    case 'OK':
    case 'COMPLETED':
      return 'approved';
    case 'PENDING':
      return 'pending';
    case 'FAILED':
    case 'REJECTED':
      return 'rejected';
    case 'CANCELED':
      return 'cancelled';
    case 'REFUNDED':
      return 'refunded';
    case 'CHARGED_BACK':
      return 'charged_back';
    default:
      return status ?? 'unknown';
  }
}

export interface RespostaWiven {
  transactionId?: string;
  status?: string;
  fee?: number;
  order?: { id?: string; url?: string; receiptUrl?: string };
  pix?: { code?: string; image?: string; base64?: string };
  details?: string;
  errorDescription?: string;
  identifier?: string;
  amount?: number;
  metadata?: { orderId?: string } & Record<string, unknown>;
}

export function traduzir(
  r: RespostaWiven,
  contexto: { identifier: string; meio: 'pix' | 'cartao'; brutoCentavos: number }
): ResultadoPagamento {
  /**
   * **Pix recém-criado nunca vale `approved`.**
   *
   * A resposta de criação do Pix traz `status: "OK"` no exemplo da
   * documentação — e ali o QR Code acabou de ser gerado, ninguém pagou nada.
   * `OK` na criação significa "a cobrança foi criada", não "o dinheiro
   * entrou"; para o cartão, que é síncrono, significa autorizado.
   *
   * Traduzir `OK` de Pix como `approved` gravaria uma venda que não existe no
   * momento em que a pessoa ainda está abrindo o aplicativo do banco. O
   * acesso não vazaria (só o webhook libera), mas o painel financeiro
   * passaria a contar dinheiro que não entrou — que é exatamente o bug de
   * 22/08 que já custou uma noite.
   *
   * Então: Pix criado é `pending`, sempre. Quem promove a `approved` é o
   * webhook. **Confirmar na documentação de callback** que é essa a leitura.
   */
  const status =
    contexto.meio === 'pix' && r.status === 'OK' ? 'pending' : traduzirStatus(r.status);

  const taxaCentavos = emCentavos(r.fee);

  return {
    idExterno: r.transactionId ?? '',
    status,
    statusDetalhe: r.details ?? r.errorDescription ?? '',
    referenciaExterna: pedidoDoIdentificador(r.identifier ?? contexto.identifier),
    brutoCentavos: emCentavos(r.amount) ?? contexto.brutoCentavos,
    taxaCentavos,
    liquidoCentavos:
      taxaCentavos === null ? null : (emCentavos(r.amount) ?? contexto.brutoCentavos) - taxaCentavos,
    metodo: contexto.meio === 'pix' ? 'pix' : 'credit_card',
    pix: r.pix?.code
      ? {
          copiaECola: r.pix.code,
          /**
           * A Wiven **deprecou o base64** — o campo existe e volta sempre
           * vazio. Quem desenha o QR é a URL de `image`, e o `?? ''` mantém o
           * contrato do tipo compartilhado sem inventar um base64 que não
           * existe.
           */
          qrBase64: '',
          qrUrl: r.pix.image,
        }
      : undefined,
  };
}

/* ── o que o front precisa mandar ─────────────────────────────────────────*/

/** Os campos do cartão. **Nunca gravados, nunca logados.** Só de passagem. */
export interface CartaoWiven {
  number: string;
  owner: string;
  /** `YYYY-MM`. */
  expiresAt: string;
  cvv: string;
}

export interface DadosCriacaoWiven extends DadosCriacao {
  wiven: {
    meio: 'pix' | 'cartao';
    nome: string;
    /** `(11) 99999-9999`, com ou sem formatação. Obrigatório nos dois meios. */
    telefone: string;
    /** CPF. Obrigatório nos dois meios. */
    documento: string;
    /** Só no cartão. */
    ip?: string;
    cartao?: CartaoWiven;
    endereco?: EnderecoWiven;
  };
}

/**
 * O CEP no formato que a Wiven valida: `#####-###`.
 *
 * ── Como isto apareceu ────────────────────────────────────────────────────
 *
 * O checkout manda o CEP só com dígitos, e o endpoint de ASSINATURA recusou
 * com `"Invalid zip code"` — enquanto o exemplo da documentação deles traz
 * `"12345-678"`, formatado. O endpoint de cobrança avulsa é mais tolerante,
 * então o problema só apareceu no dia em que a assinatura foi cobrada.
 *
 * Normaliza aqui, num lugar só, e vale para os dois caminhos: mandar o
 * formato do exemplo deles é sempre a aposta mais segura, e nada se perde se
 * o outro endpoint já aceitava sem o traço.
 *
 * O que não bate com oito dígitos volta como veio — recusar aqui trocaria uma
 * mensagem clara do gateway por um erro nosso, mais pobre.
 */
export function cepParaWiven(bruto: string | undefined | null): string {
  const digitos = (bruto ?? '').replace(/\D/g, '');
  if (digitos.length !== 8) return bruto ?? '';
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

/** Só o cartão exige endereço. O Pix pede apenas nome, e-mail, telefone e CPF. */
export interface EnderecoWiven {
  country: string;
  zipCode: string;
  state: string;
  city: string;
  street: string;
  neighborhood: string;
  number: string;
  complement?: string;
}

/**
 * O gateway não atendeu — e a cobrança **com certeza não foi criada**.
 *
 * A certeza é o ponto. Quem pega este erro pode cobrar em outro gateway sem
 * risco de cobrar a mesma pessoa duas vezes. Por isso tempo esgotado NÃO é
 * este erro: ali a resposta se perdeu, e a cobrança pode existir do outro
 * lado sem a gente saber.
 */
export class ErroDeGatewayIndisponivel extends Error {
  readonly indisponivel = true;
}

/* ── o provedor ───────────────────────────────────────────────────────────*/

export class ProvedorWiven implements ProvedorPagamento {
  async criarPagamento(dados: DadosCriacao): Promise<ResultadoPagamento> {
    const extra = (dados as Partial<DadosCriacaoWiven>).wiven;
    if (!extra) throw new Error('[wiven] dados do front ausentes');

    /**
     * O preço é relido do produto no servidor, com o desconto que já está
     * gravado no pedido. Nunca vem do navegador — `amount` editável pelo
     * cliente seria preço editável pelo cliente.
     */
    const preco = precoComDesconto(dados.produto, dados.descontoPercentual);
    const identifier = identificadorDe(dados.pedidoId);
    const splits = splitsDe(preco.finalCentavos);

    const corpo = {
      identifier,
      amount: emReais(preco.finalCentavos),
      client: {
        name: extra.nome,
        email: dados.emailDoPedido,
        phone: extra.telefone,
        document: extra.documento,
        ...(extra.meio === 'cartao' && extra.endereco
          ? { address: { ...extra.endereco, zipCode: cepParaWiven(extra.endereco.zipCode) } }
          : {}),
      },
      /**
       * `metadata.orderId` leva o `pedidoId` LIMPO, sem o sufixo da tentativa.
       *
       * Redundante com o `identifier` de propósito: se o callback trouxer um
       * dos dois, o pedido é reencontrado. Descobrir qual dos dois ele traz
       * depois de uma venda perdida é caro demais para valer a economia de um
       * campo.
       */
      metadata: { provider: 'Bruxario', orderId: dados.pedidoId },
      callbackUrl: urlDeCallback(),
      // Só entra no corpo quando configurado: campo vazio em gateway de
      // terceiro é convite para validação recusar a cobrança.
      ...(splits.length ? { splits } : {}),
      ...(extra.meio === 'cartao'
        ? {
            clientIp: extra.ip,
            card: extra.cartao,
            // Parcelar quinze reais faz o produto parecer mais caro do que é.
            installments: 1,
          }
        : {}),
    };

    let resposta: Response;
    try {
      resposta = await chamar(
        extra.meio === 'pix' ? '/gateway/pix/receive' : '/gateway/card/receive',
        { method: 'POST', body: JSON.stringify(corpo) }
      );
    } catch (erro) {
      /**
       * Rede caindo, DNS, TLS. **Tempo esgotado NÃO entra aqui como
       * indisponibilidade recuperável** — ver `ErroDeGatewayIndisponivel`.
       */
      const tempoEsgotado =
        erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError');

      if (!tempoEsgotado) {
        marcarIndisponivel('wiven', `rede: ${String(erro).slice(0, 120)}`);
        throw new ErroDeGatewayIndisponivel(`[wiven] rede indisponível: ${String(erro)}`);
      }

      /**
       * O tempo estourou e a cobrança PODE ter sido criada do outro lado.
       * Derruba a chave para as próximas pessoas, mas não deixa esta ser
       * cobrada de novo em outro gateway — o webhook ainda pode chegar.
       */
      marcarIndisponivel('wiven', 'tempo esgotado');
      throw new Error(`[wiven] tempo esgotado — a cobrança pode ter sido criada`);
    }

    if (!resposta.ok) {
      /**
       * O texto do gateway, nunca o corpo que a gente mandou.
       *
       * Ecoar o corpo aqui colocaria PAN e CVV no log de erro — o lugar onde
       * dado de cartão mais costuma vazar, porque ninguém trata log de erro
       * como dado sensível.
       */
      const texto = await resposta.text();

      /**
       * 403 com página de desafio, 429, 5xx: o serviço não está atendendo.
       * Derruba a chave para que a PRÓXIMA tela já nasça no gateway padrão,
       * em vez de cada pessoa descobrir sozinha que não dá para pagar.
       *
       * Recusa de cartão não passa por aqui — ela volta 201 com status
       * `FAILED`, e derrubar o gateway porque alguém digitou o número errado
       * tiraria do ar um serviço que está funcionando.
       */
      if (ehIndisponibilidade(resposta.status)) {
        marcarIndisponivel('wiven', `HTTP ${resposta.status}`);
        throw new ErroDeGatewayIndisponivel(
          `[wiven] indisponível (${resposta.status}): ${texto.slice(0, 200)}`
        );
      }

      throw new Error(`[wiven] cobrança recusada (${resposta.status}): ${texto}`);
    }

    const resultado = traduzir((await resposta.json()) as RespostaWiven, {
      identifier,
      meio: extra.meio,
      brutoCentavos: preco.finalCentavos,
    });

    /**
     * Quanto saiu para outras contas, gravado com a cobrança.
     *
     * O webhook chega depois e só sabe dizer o que SOBROU. Sem este número,
     * a taxa do gateway é deduzida por subtração e engole o split junto — foi
     * o que fez a venda de 27/08 aparecer com R$ 12,57 de taxa numa venda de
     * R$ 18,90.
     */
    /**
     * Qual das fatias é a da plataforma.
     *
     * `WIVEN_PRODUCER_DO_DONO` é o `producerId` de quem é dono do sistema. A
     * fatia dele sai do lucro reportado à agência: para quem lê o painel de
     * campanha, plataforma é custo, não resultado.
     *
     * Vazio = nenhuma fatia é tratada como da plataforma, e o lucro reportado
     * passa a ser tudo que sobrou da taxa. É o comportamento certo para quem
     * não divide com plataforma nenhuma.
     */
    const dono = process.env.WIVEN_PRODUCER_DO_DONO?.trim();
    const emCentavos = (s: SplitWiven) => Math.round(s.amount * 100);

    return {
      ...resultado,
      splitCentavos: splits.reduce((soma, s) => soma + emCentavos(s), 0),
      splitDoDonoCentavos: dono
        ? splits.filter((s) => s.producerId === dono).reduce((soma, s) => soma + emCentavos(s), 0)
        : 0,
    };
  }

  /**
   * `GET /gateway/transactions`, por `id` ou por `clientIdentifier`.
   *
   * `clientIdentifier` é o nosso `identifier` de volta — a documentação diz
   * "corresponde ao valor enviado por você na criação". É o que torna a
   * consulta útil quando o webhook chegou sem `identifier`.
   *
   * ── Cuidado com o dinheiro aqui ───────────────────────────────────────
   *
   * Este endpoint tem o TERCEIRO vocabulário de dinheiro da Wiven:
   * `chargeAmount` é "valor pago pelo cliente" e `amount` é "o valor que você
   * vai receber". Nenhum dos dois é a taxa, e não há campo de taxa nenhum.
   *
   * Então a taxa fica `null` de propósito. Inventá-la a partir da diferença
   * entre os dois seria chutar: a diferença existe por juros de parcelamento
   * do checkout interno, não pela nossa taxa. Quem sabe a taxa é o webhook,
   * pelo `commissionAmount`, e é de lá que o painel financeiro se alimenta.
   */
  async consultarPagamento(idExterno: string): Promise<ResultadoPagamento | null> {
    try {
      const resposta = await chamar(`/gateway/transactions?id=${encodeURIComponent(idExterno)}`);
      if (!resposta.ok) {
        console.error(`[wiven] consulta a ${idExterno} falhou (${resposta.status})`);
        return null;
      }

      const corpo = (await resposta.json()) as RespostaConsultaWiven | RespostaConsultaWiven[];
      // "Buscar transações", no plural — mas com `id` volta uma só. Aceita as
      // duas formas em vez de apostar em qual delas a rota devolve hoje.
      const t = Array.isArray(corpo) ? corpo[0] : corpo;
      if (!t?.id) return null;

      return traduzirConsulta(t);
    } catch (erro) {
      console.error(`[wiven] consulta a ${idExterno} lançou:`, erro);
      return null;
    }
  }

  /**
   * `POST /gateway/producer/refunds`.
   *
   * **Não é estorno imediato: é solicitação.** A resposta volta `PENDING` e
   * "entra em análise". Diferente do Mercado Pago, onde o estorno é o fato.
   *
   * Quem chama isto (o botão do painel) precisa saber: `ok: true` aqui
   * significa "pedido registrado", não "dinheiro devolvido".
   */
  async estornar(idExterno: string): Promise<{ ok: boolean; erro?: string }> {
    try {
      const resposta = await chamar('/gateway/producer/refunds', {
        method: 'POST',
        body: JSON.stringify({
          transactionId: idExterno,
          reason: 'Estorno solicitado pelo painel do Bruxário',
        }),
      });

      if (resposta.ok) return { ok: true };

      const texto = await resposta.text();

      /**
       * 422 com reembolso já existente **não é falha**.
       *
       * O botão do painel pode ser clicado duas vezes, e a segunda tentativa
       * devolver erro faria alguém achar que o estorno não aconteceu e ir
       * mexer no gateway à mão. O desfecho desejado já está de pé.
       */
      if (resposta.status === 422 && /reembolso/i.test(texto)) {
        return { ok: true };
      }

      return { ok: false, erro: `[wiven] estorno recusado (${resposta.status}): ${texto}` };
    } catch (erro) {
      return { ok: false, erro: `[wiven] estorno lançou: ${String(erro)}` };
    }
  }

  /**
   * ── Não dá para implementar, e o silêncio seria pior ────────────────────
   *
   * `GET /gateway/transactions` aceita `id` e `clientIdentifier`. **Não
   * aceita intervalo de datas.** A alternativa seria consultar uma a uma as
   * nossas vendas do período — que é exatamente o padrão que a documentação
   * deles desencoraja no item "Polling bloqueado".
   *
   * Devolver `[]` seria a saída fácil e a pior: a reconciliação concluiria em
   * silêncio que a Wiven não tem nenhum pagamento aprovado no período, e
   * marcaria como suspeita toda venda que o webhook gravou direito. Um alarme
   * que grita errado é pior que alarme nenhum — quem apaga o alarme uma vez
   * apaga sempre.
   *
   * Então lança. Reconciliação que não pode rodar precisa dizer isso.
   */
  async listarPagosNoPeriodo(_desde: Date, _ate: Date): Promise<PagamentoResumido[]> {
    throw new Error(
      '[wiven] a API não filtra transações por período — reconciliação indisponível'
    );
  }
}

/* ── a consulta ───────────────────────────────────────────────────────────*/

export interface RespostaConsultaWiven {
  id?: string;
  clientIdentifier?: string | null;
  status?: string;
  paymentMethod?: string;
  /** "Valor que você vai receber". */
  amount?: number;
  /** "Valor pago pelo cliente" — é este que vale como bruto da venda. */
  chargeAmount?: number;
  statusDescription?: string | null;
  errorDescription?: string | null;
  payedAt?: string | null;
  refundedAt?: string | null;
  pixInformation?: { qrCode?: string; image?: string; base64?: string } | null;
}

export function traduzirConsulta(t: RespostaConsultaWiven): ResultadoPagamento {
  return {
    idExterno: t.id ?? '',
    status: traduzirStatus(t.status),
    statusDetalhe: t.statusDescription ?? t.errorDescription ?? '',
    referenciaExterna: pedidoDoIdentificador(t.clientIdentifier),
    brutoCentavos: emCentavos(t.chargeAmount) ?? emCentavos(t.amount),
    // Não existe campo de taxa nesta rota. Ver o comentário em `consultarPagamento`.
    taxaCentavos: null,
    liquidoCentavos: null,
    metodo: t.paymentMethod === 'PIX' ? 'pix' : (t.paymentMethod?.toLowerCase() ?? null),
    pix: t.pixInformation?.qrCode
      ? { copiaECola: t.pixInformation.qrCode, qrBase64: '', qrUrl: t.pixInformation.image }
      : undefined,
  };
}

/* ── o corpo do webhook ───────────────────────────────────────────────────*/

export type EventoWiven =
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_PAID'
  | 'TRANSACTION_CANCELED'
  | 'TRANSACTION_REFUNDED'
  | 'TRANSACTION_CHARGED_BACK';

export interface CorpoWebhookWiven {
  event?: string;
  /** O que prova que a notificação é dela. Viaja no CORPO, não em header. */
  token?: string;
  /**
   * Código da oferta — e a documentação é explícita: **"vendas via checkout
   * interno"**, anulável.
   *
   * Ou seja: ele é propriedade da SESSÃO de checkout hospedado deles, não da
   * transação. Cobrança criada pela API não abre sessão nenhuma, então este
   * campo vem nulo por definição — não por bug nosso, e não por falta de
   * mandar `products` no corpo.
   *
   * Isso decide a §7.3 do `PLANO-FLUXO-UTM.md`: se a integração nativa
   * Wiven↔UTMify escuta venda de oferta, ela não vai disparar enquanto a
   * cobrança for por API. **Quem avisa a UTMify continua sendo o nosso
   * código.**
   */
  offerCode?: string | null;
  /**
   * A URL do checkout que o cliente acessou, com sessão, oferta, afiliação e
   * UTMs. **"Vazia quando não há sessão de checkout associada"** — de novo, o
   * caso da cobrança por API.
   *
   * Fica registrado porque é a única via pela qual os UTMs voltariam para nós
   * pelo lado deles. Como ela vem vazia aqui, os UTMs continuam sendo
   * responsabilidade nossa, guardados em `utm_json` no pedido.
   */
  checkoutUrl?: string | null;
  client?: { name?: string; email?: string; cpf?: string };
  transaction?: {
    id?: string;
    /** O nosso `identifier`. **Anulável** — ver `pedidoDoWebhook`. */
    identifier?: string | null;
    status?: string;
    paymentMethod?: string;
    amount?: number;
    /** "Valor líquido a ser recebido" — é o LÍQUIDO, não a taxa. */
    commissionAmount?: number;
    currency?: string;
    payedAt?: string | null;
    pixInformation?: { qrCode?: string; endToEndId?: string | null } | null;
  };
  trackProps?: Record<string, string>;
}

/**
 * O pedido que a notificação diz respeito.
 *
 * **`transaction.identifier` é anulável** — a documentação marca o campo como
 * `nullable`, e o exemplo de payload dela nem sequer o traz. Confiar só nele
 * seria apostar a entrega numa string que a própria Wiven avisa que pode
 * chegar vazia.
 *
 * Por isso o webhook tem dois caminhos: este, e o `transaction.id`, que a
 * gente grava no pedido no instante da criação. Um dos dois acha.
 */
export function pedidoDoWebhook(corpo: CorpoWebhookWiven): string | null {
  return pedidoDoIdentificador(corpo.transaction?.identifier);
}

/**
 * O corpo do webhook vira o mesmo `ResultadoPagamento` que todo o resto do
 * projeto já sabe consumir.
 *
 * ── A contabilidade é ao contrário da criação ─────────────────────────────
 *
 * Na criação, `fee` é **a taxa**. No webhook, `commissionAmount` é
 * **o líquido** ("valor líquido a ser recebido"). Mesmo gateway, dois campos
 * de dinheiro com sentidos opostos.
 *
 * Tratar um como o outro inverteria o painel financeiro: numa venda de
 * R$ 9,80 com R$ 2,58 de taxa, o lucro apareceria como R$ 2,58 em vez de
 * R$ 7,22 — ou pior, R$ 7,22 viraria taxa e o lucro, R$ 2,58. É a mesma
 * família do bug de 22/08, e ela já custou uma noite.
 */
export function traduzirWebhook(corpo: CorpoWebhookWiven): ResultadoPagamento {
  const t = corpo.transaction ?? {};
  const brutoCentavos = emCentavos(t.amount);
  const liquidoCentavos = emCentavos(t.commissionAmount);

  return {
    idExterno: t.id ?? '',
    status: traduzirStatus(t.status),
    statusDetalhe: corpo.event ?? '',
    referenciaExterna: pedidoDoWebhook(corpo),
    // O cru, para a renovação da assinatura poder se reencontrar por ele.
    identificadorBruto: t.identifier ?? null,
    brutoCentavos,
    taxaCentavos:
      brutoCentavos === null || liquidoCentavos === null ? null : brutoCentavos - liquidoCentavos,
    liquidoCentavos,
    metodo: t.paymentMethod === 'PIX' ? 'pix' : (t.paymentMethod?.toLowerCase() ?? null),
  };
}

/**
 * Os tokens que provam que a notificação é da Wiven. **Plural.**
 *
 * ── Por que mais de um (medido em 24/08) ──────────────────────────────────
 *
 * A Wiven entrega o mesmo evento por DOIS caminhos, com credenciais
 * diferentes:
 *
 *   1. o webhook que a conta já tinha, com o token que está no `.env`
 *   2. um webhook que **ela cria sozinha** a partir do `callbackUrl` que
 *      mandamos no corpo de cada cobrança — e esse nasce com token próprio,
 *      visível no painel como "API CallbackURL"
 *
 * Na primeira noite isso apareceu como oito `token não confere` no log: a
 * entrega 1 passava e a 2 era recusada. Nada se perdia, mas um log cheio de
 * recusa de autenticação é um alarme que a gente aprende a ignorar — e o dia
 * em que ele for de verdade, ninguém vai olhar.
 *
 * Aceitar os dois é seguro porque o processamento já tolera repetição: todo
 * gateway reenvia notificação, e `processarNotificacaoDePagamento` é
 * idempotente desde o Mercado Pago.
 *
 * Separados por vírgula. Espaço em volta é tolerado — token colado de painel
 * vem com espaço mais vezes do que se imagina.
 */
export function tokensDoWebhook(): string[] {
  return (process.env.WIVEN_WEBHOOK_TOKEN ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Compatibilidade: o primeiro token, para quem só precisa saber se há algum. */
export function tokenDoWebhook(): string {
  return tokensDoWebhook()[0] ?? '';
}

/* ── assinatura recorrente ────────────────────────────────────────────────*/

export type PeriodicidadeWiven = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

/**
 * O que a Wiven devolve sobre a assinatura criada.
 *
 * **`status` nasce `INACTIVE`** no exemplo da documentação deles, mesmo com a
 * transação em `OK` — porque no Pix ninguém pagou o QR ainda, e no cartão a
 * captura ainda não confirmou. Ela vira `ACTIVE` depois, e quem conta isso é
 * o webhook. Tratar `INACTIVE` como falha cancelaria assinatura que está só
 * esperando o pagamento da primeira parcela.
 */
export interface AssinaturaExterna {
  id: string;
  status: string;
  periodicidade: number;
  periodicidadeTipo: PeriodicidadeWiven;
  /** ISO. Quando a Wiven vai cobrar de novo, sozinha. */
  proximaCobrancaEm: string | null;
  iniciaEm: string | null;
}

interface RespostaAssinaturaWiven extends RespostaWiven {
  subscription?: {
    id?: string;
    periodicityType?: PeriodicidadeWiven;
    periodicity?: number;
    nextChargeAt?: string;
    startAt?: string;
    status?: string;
  };
}

export interface DadosDeAssinatura {
  /** O id da nossa `cobranca`. Vira o `identifier`, como no pedido avulso. */
  cobrancaId: string;
  emailDoCliente: string;
  plano: { id: string; nome: string; precoCentavos: number };
  periodicidade: { tipo: PeriodicidadeWiven; quantidade: number };
  wiven: DadosCriacaoWiven['wiven'];
}

/**
 * Traduz a duração de um plano nosso para a periodicidade deles.
 *
 * 30 dias vira **1 MONTHS**, e não 30 DAYS, de propósito: `MONTHS` acompanha
 * o calendário, então quem assina dia 31 de janeiro é cobrado em fevereiro no
 * dia que existir. Com `DAYS`, a data da cobrança anda para trás todo mês e
 * em um ano a pessoa é cobrada treze vezes — uma a mais do que contratou.
 */
export function periodicidadeDe(duracaoDias: number | null): {
  tipo: PeriodicidadeWiven;
  quantidade: number;
} {
  if (!duracaoDias || duracaoDias <= 0) return { tipo: 'MONTHS', quantidade: 1 };
  if (duracaoDias % 365 === 0) return { tipo: 'YEARS', quantidade: duracaoDias / 365 };
  if (duracaoDias % 30 === 0) return { tipo: 'MONTHS', quantidade: duracaoDias / 30 };
  if (duracaoDias % 7 === 0) return { tipo: 'WEEKS', quantidade: duracaoDias / 7 };
  return { tipo: 'DAYS', quantidade: duracaoDias };
}

/**
 * Cria uma assinatura de verdade — a Wiven cobra sozinha nos meses seguintes.
 *
 * ── O que muda em relação à cobrança avulsa ───────────────────────────────
 *
 * Rotas próprias (`/gateway/pix/subscription` e `/gateway/card/subscription`),
 * um objeto `product` obrigatório e um `subscription` com a periodicidade. O
 * resto do corpo é o mesmo, e por isso o cliente, o cartão e o endereço saem
 * das mesmas estruturas do checkout avulso.
 *
 * Antes disto, "assinatura" aqui era uma cobrança única de 30 dias com um
 * e-mail pedindo para pagar de novo. Funcionava, e perdia todo mundo que não
 * abrisse o e-mail.
 *
 * ── Sobre o split: ele NÃO existe aqui ────────────────────────────────────
 *
 * A documentação dos dois endpoints de assinatura **não lista `splits`** —
 * ele aparece só nas cobranças avulsas. Mandar campo que o gateway não
 * conhece é convite para `INVALID_INPUT` recusar a cobrança inteira, então
 * ele não vai.
 *
 * Consequência: **a receita de assinatura cai inteira na conta que cobra.**
 * Hoje isso é o combinado (01/09/2026: tudo na conta do Murilo), então não há
 * nada a resolver. No dia em que voltar a haver repasse, a divisão da
 * assinatura precisa ser resolvida com eles — por coprodução no produto, ou
 * perguntando se `splits` vale nesta rota.
 */
export async function criarAssinaturaWiven(
  dados: DadosDeAssinatura
): Promise<ResultadoPagamento & { assinatura: AssinaturaExterna | null }> {
  const extra = dados.wiven;
  const identifier = identificadorDe(dados.cobrancaId);
  const emReaisDoPlano = emReais(dados.plano.precoCentavos);

  const corpo = {
    identifier,
    amount: emReaisDoPlano,
    /*
      `product` é obrigatório nas rotas de assinatura, e o `id` é "ID único do
      produto na SUA aplicação" — ou seja, o nosso `plano.id`, não um código
      do catálogo deles. Não é a migração para produtos da Wiven; é só como
      esta rota identifica o que está sendo assinado.
    */
    product: {
      id: dados.plano.id,
      name: dados.plano.nome,
      quantity: 1,
      price: emReaisDoPlano,
    },
    subscription: {
      periodicityType: dados.periodicidade.tipo,
      periodicity: dados.periodicidade.quantidade,
      // Cobra agora. Qualquer outro valor daria acesso antes do dinheiro.
      firstChargeIn: 0,
    },
    client: {
      name: extra.nome,
      email: dados.emailDoCliente,
      phone: extra.telefone,
      document: extra.documento,
      ...(extra.meio === 'cartao' && extra.endereco
        ? { address: { ...extra.endereco, zipCode: cepParaWiven(extra.endereco.zipCode) } }
        : {}),
    },
    metadata: { provider: 'Bruxario', orderId: dados.cobrancaId },
    callbackUrl: urlDeCallback(),
    ...(extra.meio === 'cartao' ? { clientIp: extra.ip, card: extra.cartao } : {}),
  };

  let resposta: Response;
  try {
    resposta = await chamar(
      extra.meio === 'pix' ? '/gateway/pix/subscription' : '/gateway/card/subscription',
      { method: 'POST', body: JSON.stringify(corpo) }
    );
  } catch (erro) {
    const tempoEsgotado =
      erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError');

    if (!tempoEsgotado) {
      marcarIndisponivel('wiven', `rede: ${String(erro).slice(0, 120)}`);
      throw new ErroDeGatewayIndisponivel(`[wiven] rede indisponível: ${String(erro)}`);
    }

    /*
      Tempo esgotado numa ASSINATURA é pior que numa cobrança avulsa: se ela
      nasceu do outro lado, existe agora um contrato recorrente que o nosso
      banco não conhece — e ele cobra todo mês. Nunca cai para outro gateway
      aqui; a pessoa tenta de novo e o `identifier` único evita duplicata.
    */
    marcarIndisponivel('wiven', 'tempo esgotado');
    throw new Error('[wiven] tempo esgotado — a assinatura pode ter sido criada');
  }

  if (!resposta.ok) {
    const texto = await resposta.text();
    if (ehIndisponibilidade(resposta.status)) {
      marcarIndisponivel('wiven', `HTTP ${resposta.status}`);
      throw new ErroDeGatewayIndisponivel(
        `[wiven] indisponível (${resposta.status}): ${texto.slice(0, 200)}`
      );
    }
    throw new Error(`[wiven] assinatura recusada (${resposta.status}): ${texto}`);
  }

  const bruta = (await resposta.json()) as RespostaAssinaturaWiven;

  /*
    O mesmo tradutor da cobrança avulsa, e pelo mesmo motivo: `status: "OK"`
    na criação quer dizer "a cobrança nasceu", não "o dinheiro entrou". Só o
    webhook libera acesso.
  */
  const resultado = traduzir(bruta, {
    identifier,
    meio: extra.meio,
    brutoCentavos: dados.plano.precoCentavos,
  });

  const s = bruta.subscription;
  return {
    ...resultado,
    assinatura: s?.id
      ? {
          id: s.id,
          status: s.status ?? 'INACTIVE',
          periodicidade: s.periodicity ?? dados.periodicidade.quantidade,
          periodicidadeTipo: s.periodicityType ?? dados.periodicidade.tipo,
          proximaCobrancaEm: s.nextChargeAt ?? null,
          iniciaEm: s.startAt ?? null,
        }
      : null,
  };
}
