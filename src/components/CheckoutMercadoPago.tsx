'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Copy, Check } from 'lucide-react';
import { marcar } from '@/lib/marcar';

/**
 * Payment Brick do Mercado Pago montado dentro da nossa tela.
 *
 * O SPEC 10.3 escolhe esse caminho de propósito em vez do checkout
 * redirecionado: "mandar alguém do meio de um ritual de vela e lua para uma
 * tela laranja e voltar" quebra a ambientação que o produto inteiro constrói.
 *
 * O SDK do MP não tem tipos publicados, então a superfície que usamos está
 * declarada abaixo — de propósito mínima, só o que chamamos.
 */
interface BrickBuilder {
  create(
    tipo: 'payment',
    containerId: string,
    settings: Record<string, unknown>
  ): Promise<{ unmount(): void }>;
}
interface MercadoPagoSdk {
  bricks(): BrickBuilder;
}
declare global {
  interface Window {
    MercadoPago?: new (
      chave: string,
      opcoes?: { locale?: string }
    ) => MercadoPagoSdk;
  }
}

const URL_SDK = 'https://sdk.mercadopago.com/js/v2';

function carregarSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existente = document.querySelector<HTMLScriptElement>(
      `script[src="${URL_SDK}"]`
    );
    if (existente) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', () => reject(new Error('sdk')));
      return;
    }
    const script = document.createElement('script');
    script.src = URL_SDK;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sdk'));
    document.head.appendChild(script);
  });
}

interface Pix {
  copiaECola: string;
  qrBase64: string;
}

export function CheckoutMercadoPago({
  pedidoId,
  chavePublica,
  valorEmReais,
  nomeProduto,
  cupom,
  modo,
  generoDoFamiliar,
  itens,
  /**
   * Onde cobrar e para onde ir depois.
   *
   * Nasceu tudo apontando para `/api/pedido/...` porque só existia o funil do
   * ritual. Quando os planos passaram a ser vendáveis, a alternativa era um
   * segundo componente de checkout — mesma integração com o Brick, mesmo
   * tratamento de recusa, mesma espera do Pix, duplicados. Um checkout que
   * diverge do outro é o tipo de coisa que só se descobre quando um dos dois
   * para de cobrar direito.
   */
  base = 'pedido',
  caminho = 'pagamento',
  destino,
}: {
  pedidoId: string;
  chavePublica: string;
  valorEmReais: number;
  nomeProduto: string;
  /** Sete dos doze familiares são femininos — o texto precisa concordar. */
  generoDoFamiliar?: 'm' | 'f';
  /** O que a pessoa leva. No checkout ninguém lembra o que tinha no plano. */
  itens?: string[];
  /** Presente só quando o pedido nasceu com cupom. */
  cupom?: { codigo: string; descontoPercentual: number; cheioEmReais: number };
  /** `pedido` = funil do ritual; `cobranca` = assinatura de plano. */
  base?: 'pedido' | 'cobranca';
  /**
   * A rota que recebe o pagamento. `pagamento` é a compra do funil;
   * `melhorar` é a troca da Revelação pela Completa depois da entrega.
   *
   * Existe porque o Brick é o mesmo nos dois casos — duplicar o componente
   * para mudar uma palavra na URL criaria dois checkouts que divergem, e o
   * tipo de divergência que só se descobre quando um deles para de cobrar.
   */
  caminho?: 'pagamento' | 'melhorar';
  /** Para onde ir quando confirmar. Padrão: a tela de obrigado do pedido. */
  destino?: string;
  /** Quando não é `producao`, a tela precisa dizer isso em voz alta. */
  modo?: 'fake' | 'teste' | 'producao';
}) {
  const container = useRef<HTMLDivElement>(null);
  const jaMontou = useRef(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<Pix | null>(null);
  const [recusado, setRecusado] = useState('');
  // Cartão em análise: o webhook ainda pode aprovar, então a tela espera.
  const [emAnalise, setEmAnalise] = useState(false);

  useEffect(() => {
    // StrictMode monta o efeito duas vezes em dev; sem essa guarda o Brick
    // aparece duplicado na tela.
    if (jaMontou.current) return;
    jaMontou.current = true;

    let controlador: { unmount(): void } | null = null;
    let cancelado = false;

    (async () => {
      try {
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return;

        const mp = new window.MercadoPago(chavePublica, { locale: 'pt-BR' });
        controlador = await mp.bricks().create('payment', 'brick-pagamento', {
          initialization: {
            amount: valorEmReais,
          },
          /**
           * ── Por que só Pix e cartão de crédito ──────────────────────────
           *
           * **Boleto saiu.** Compensa em 1 a 3 dias úteis, e isto é uma
           * compra de impulso de quinze reais que só existe no minuto em que
           * a pessoa terminou o teste. Oferecer boleto é oferecer adiar — e
           * adiar, aqui, é não comprar.
           *
           * **Débito saiu.** Praticamente ninguém usa débito virtual no
           * Brasil; a linha só engordava a lista e dava cara de gateway
           * genérico.
           *
           * ── A cor ────────────────────────────────────────────────────────
           *
           * O ciano é o padrão do Bricks e destoa de tudo: a paleta do site é
           * índigo, creme e âmbar. Depois de treze minutos de ritual, um
           * botão turquesa de fintech quebra a ilusão inteira.
           */
          customization: {
            paymentMethods: {
              creditCard: 'all',
              bankTransfer: 'all', // Pix
              debitCard: [],
              ticket: [],
              // Parcelar quinze reais faz o produto parecer mais caro do que é.
              maxInstallments: 1,
            },
            visual: {
              style: {
                theme: 'dark',
                customVariables: {
                  baseColor: '#D9A441',
                  baseColorFirstVariant: '#C08F33',
                  baseColorSecondVariant: '#8A6A2F',
                  textPrimaryColor: '#EAE0CC',
                  textSecondaryColor: 'rgba(234,224,204,0.65)',
                  inputBackgroundColor: 'rgba(234,224,204,0.05)',
                  formBackgroundColor: 'transparent',
                  baseColorInverted: '#171225',
                  borderRadiusMedium: '12px',
                  borderRadiusLarge: '16px',
                },
              },
            },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async ({ formData }: { formData: unknown }) => {
              setErro('');
              setRecusado('');
              // Estava declarado em MARCOS e nunca disparava. É o degrau
              // "apertou pagar" — distinto de "abriu o checkout".
              marcar('pagamento_tentado');
              const resposta = await fetch(`/api/${base}/${pedidoId}/${caminho}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData }),
              });
              const dados = await resposta.json();

              if (!resposta.ok) {
                setErro(dados.erro || 'O véu está denso esta noite.');
                throw new Error(dados.erro || 'falha');
              }

              if (dados.redirect) {
                window.location.href = dados.redirect;
                return;
              }
              if (dados.pix) {
                setPix(dados.pix);
                return;
              }
              // pendente/recusado sem Pix: cartão negado ou em análise.
              const pendente =
                dados.status === 'pending' || dados.status === 'in_process';
              setEmAnalise(pendente);
              setRecusado(mensagemDeStatus(dados.status, dados.statusDetalhe));
            },
            onError: (e: unknown) => {
              console.error('[brick] erro:', e);
              setErro('Não conseguimos abrir o pagamento. Recarregue a página.');
            },
          },
        });
      } catch {
        if (!cancelado) {
          setErro('Não conseguimos abrir o pagamento. Recarregue a página.');
        }
      }
    })();

    return () => {
      cancelado = true;
      controlador?.unmount();
    };
  }, [pedidoId, chavePublica, valorEmReais]);

  if (pix) return <TelaPix pix={pix} pedidoId={pedidoId} base={base} destino={destino} />;
  if (emAnalise) return <TelaEmAnalise pedidoId={pedidoId} base={base} destino={destino} />;

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      {modo && modo !== 'producao' && <FaixaDeModo modo={modo} />}

      <div className="text-center flex flex-col items-center gap-3">
        <Flame className="text-vela" size={28} strokeWidth={1.5} />
        <h1 className="font-display italic text-2xl text-pergaminho">
          {generoDoFamiliar === 'f'
            ? 'Ela está esperando do outro lado.'
            : 'Ele está esperando do outro lado.'}
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/60">
          {cupom ? (
            <>
              <span className="line-through opacity-50">
                {`R$ ${cupom.cheioEmReais.toFixed(2).replace('.', ',')}`}
              </span>{' '}
              {`${nomeProduto} · R$ ${valorEmReais.toFixed(2).replace('.', ',')}`}
            </>
          ) : (
            `${nomeProduto} · R$ ${valorEmReais.toFixed(2).replace('.', ',')}`
          )}
        </p>
        {cupom && (
          <p className="font-corpo text-xs text-ouro-profundo mt-1">
            {`Cupom ${cupom.codigo} · ${cupom.descontoPercentual}% de desconto`}
          </p>
        )}
      </div>

      {recusado && (
        <p className="font-corpo text-sm text-center text-vela/90 bg-vela/10 border border-vela/20 rounded-2xl px-4 py-3">
          {recusado}
        </p>
      )}
      {erro && (
        <p className="font-corpo text-sm text-center text-red-300">{erro}</p>
      )}

      {/*
        O que ela leva, aqui no checkout.
        Entre escolher o plano e digitar o cartão passam duas telas — ninguém
        chega aqui lembrando o que tinha na lista. "Completa" sozinho, no
        momento de pagar, não significa nada.
      */}
      {itens && itens.length > 0 && (
        <ul className="flex flex-col gap-1.5 rounded-2xl border border-pergaminho/12 px-5 py-4">
          {itens.map((i) => (
            <li key={i}
              className="font-corpo font-light text-[13px] text-pergaminho/70 leading-snug flex gap-2">
              <span className="text-vela/70 shrink-0">·</span>
              {i}
            </li>
          ))}
        </ul>
      )}

      <div id="brick-pagamento" ref={container} />

      {/*
        Sinal de confiança no fim, não no topo: quem está lendo aqui já
        decidiu e está com o cartão na mão. No topo, isto seria só ruído
        antes da decisão.
      */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="font-corpo text-[11px] text-pergaminho/45 leading-relaxed max-w-[38ch]">
          Pagamento processado pelo Mercado Pago. Não guardamos o número do seu
          cartão.
        </p>
        <p className="font-corpo text-[11px] text-pergaminho/45 leading-relaxed max-w-[38ch]">
          Assim que confirmar, a leitura é gerada e cai no seu e-mail. Sete
          dias para desistir e receber tudo de volta, sem precisar explicar.
        </p>
      </div>
    </div>
  );
}

/**
 * Faixa de modo não-produção.
 *
 * Existe porque o erro mais caro aqui é silencioso nos dois sentidos: achar
 * que uma cobrança de teste foi real (e esperar dinheiro que não vem), ou
 * achar que uma cobrança real foi teste (e cobrar alguém sem querer). A tela
 * precisa dizer, sem que ninguém precise abrir o .env.
 */
function FaixaDeModo({ modo }: { modo: 'fake' | 'teste' }) {
  const texto =
    modo === 'fake'
      ? 'Sem gateway configurado — a compra é aprovada na hora, nada é cobrado.'
      : 'Modo de teste do Mercado Pago — use os cartões de teste. Nenhuma cobrança real acontece.';

  return (
    <p
      role="status"
      className="w-full text-center font-corpo text-xs leading-relaxed text-tinta bg-vela/90 rounded-xl px-4 py-2.5"
    >
      <strong className="font-semibold tracking-wide uppercase">
        {modo === 'fake' ? 'Sem cobrança' : 'Modo teste'}
      </strong>
      <br />
      {texto}
    </p>
  );
}

/**
 * Cartão em análise: mesma espera do Pix, outra copy.
 *
 * O Mercado Pago às vezes devolve `in_process` e aprova segundos depois. A
 * tela antiga mostrava "está em análise" e parava ali — a pessoa tinha o
 * dinheiro reservado no cartão e nenhuma indicação de que algo ia acontecer.
 */
function TelaEmAnalise({
  pedidoId,
  base,
  destino,
}: {
  pedidoId: string;
  base: 'pedido' | 'cobranca';
  destino?: string;
}) {
  const pronto = useEsperaDoPagamento(pedidoId, base, destino);

  if (pronto) return <TelaConfirmado />;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
      <Flame className="text-vela animate-pulse" size={32} strokeWidth={1.5} />
      <h1 className="font-display italic text-2xl text-pergaminho">
        Seu banco está conferindo.
      </h1>
      <p className="font-corpo font-light text-sm text-pergaminho/60 max-w-xs">
        Isso costuma levar alguns segundos. Deixe esta página aberta — ela
        avança sozinha quando aprovar. Se demorar, a revelação chega no seu
        e-mail.
      </p>
      <span className="font-corpo text-[11px] text-pergaminho/35 inline-flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-vela animate-pulse" />
        Esperando a confirmação
      </span>
    </div>
  );
}

function TelaConfirmado() {
  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
      <Check className="text-vela" size={40} strokeWidth={1.5} />
      <h1 className="font-display italic text-2xl text-pergaminho">
        Pagamento confirmado.
      </h1>
      <p className="font-corpo font-light text-sm text-pergaminho/60">
        Abrindo a sua revelação...
      </p>
    </div>
  );
}

/**
 * Pergunta ao NOSSO servidor se o pedido saiu de `aguardando_pagamento`.
 *
 * Quem confirma o pagamento é o webhook do Mercado Pago (SPEC 10.6); isto
 * aqui só observa o resultado. Devolve `true` uma vez e para de perguntar.
 */
function useEsperaDoPagamento(
  pedidoId: string,
  base: 'pedido' | 'cobranca',
  destino?: string
): boolean {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const comecou = Date.now();

    const conferir = async () => {
      if (!vivo || Date.now() - comecou > 15 * 60_000) return;
      try {
        const r = await fetch(`/api/${base}/${pedidoId}`, { cache: 'no-store' });
        const d = await r.json();
        if (!vivo) return;
        if (d.status && d.status !== 'aguardando_pagamento') {
          setPronto(true);
          // Um respiro para a pessoa VER que confirmou antes de a tela trocar.
          const paraOnde = destino ?? `/obrigado/${pedidoId}`;
          setTimeout(() => window.location.assign(paraOnde), 1200);
          return;
        }
      } catch {
        // Rede instável no meio do pagamento não pode derrubar a tela.
      }
      if (vivo) setTimeout(conferir, 4000);
    };

    const t = setTimeout(conferir, 4000);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [pedidoId, base, destino]);

  return pronto;
}

/**
 * A tela do Pix, agora com polling.
 *
 * ── O bug que isto conserta ───────────────────────────────────────────────
 *
 * A pessoa pagava o Pix no aplicativo do banco e voltava para uma tela
 * parada, mostrando o mesmo QR de sempre. Nada dizia que tinha dado certo —
 * só recarregando na mão é que ela saía dali. Depois de transferir dinheiro,
 * uma tela que não reage lê como "o pagamento não passou", e o próximo passo
 * da pessoa é pedir estorno ou mandar mensagem no Instagram.
 *
 * O webhook do Mercado Pago é quem confirma de verdade (SPEC 10.6), então
 * aqui é só perguntar ao nosso servidor se o pedido já mudou de estado.
 *
 * ── Por que 4 segundos, e por que desiste em 15 minutos ───────────────────
 *
 * Pix costuma cair em segundos, mas o webhook pode demorar. Quatro segundos
 * é frequente o bastante para parecer instantâneo e raro o bastante para não
 * pesar. Depois de 15 minutos a pessoa provavelmente fechou a aba ou não vai
 * pagar — continuar perguntando seria bater no servidor à toa, e o e-mail de
 * entrega cobre quem pagar mais tarde.
 */
function TelaPix({
  pix,
  pedidoId,
  base,
  destino,
}: {
  pix: Pix;
  pedidoId: string;
  base: 'pedido' | 'cobranca';
  destino?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const pronto = useEsperaDoPagamento(pedidoId, base, destino);

  if (pronto) return <TelaConfirmado />;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
      <h1 className="font-display italic text-2xl text-pergaminho">
        Falta só o Pix.
      </h1>
      {pix.qrBase64 && (
        // next/image não serve aqui: o QR vem como data URI base64 do Mercado
        // Pago, então não há o que otimizar nem URL remota para carregar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${pix.qrBase64}`}
          alt="QR code do Pix"
          className="w-56 h-56 rounded-2xl bg-pergaminho p-3"
        />
      )}
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(pix.copiaECola);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
        className="inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
      >
        {copiado ? <Check size={16} /> : <Copy size={16} />}
        {copiado ? 'Copiado' : 'Copiar código Pix'}
      </button>
      <p className="font-corpo font-light text-xs text-pergaminho/50 max-w-xs">
        Deixe esta página aberta: assim que o pagamento cair, ela avança
        sozinha. Se você fechar, a revelação chega no seu e-mail do mesmo
        jeito.
      </p>
      <span className="font-corpo text-[11px] text-pergaminho/35 inline-flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-vela animate-pulse" />
        Esperando o pagamento cair
      </span>
    </div>
  );
}

/**
 * Traduz o status do MP para a voz do produto. Recusa de cartão é o momento
 * mais frágil da compra: mensagem genérica faz a pessoa desistir, e mensagem
 * técnica ("cc_rejected_insufficient_amount") assusta.
 */
function mensagemDeStatus(status: string, detalhe: string): string {
  if (status === 'pending' || status === 'in_process') {
    return 'Seu pagamento está em análise. Avisamos assim que for aprovado.';
  }
  const porDetalhe: Record<string, string> = {
    cc_rejected_insufficient_amount: 'O cartão não tem saldo suficiente.',
    cc_rejected_bad_filled_security_code: 'O código de segurança não confere.',
    cc_rejected_bad_filled_date: 'A data de validade não confere.',
    cc_rejected_bad_filled_other: 'Algum dado do cartão não confere.',
    cc_rejected_call_for_authorize: 'Seu banco precisa autorizar esta compra.',
    cc_rejected_high_risk: 'O pagamento não foi autorizado. Tente outro meio.',
  };
  return (
    porDetalhe[detalhe] ??
    'O pagamento não passou. Você pode tentar outro cartão ou pagar com Pix.'
  );
}
