'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Copy, Check } from 'lucide-react';
import { evento } from '@/lib/pixel';

/**
 * Payment Brick do Horóscopo — mesmo padrão de `CheckoutMercadoPago.tsx`
 * (produto principal), mas endpoint, chave e destino próprios. Cópia
 * deliberada, não reuso: o produto principal não pode depender de nada daqui,
 * nem o contrário.
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
    MercadoPago?: new (chave: string, opcoes?: { locale?: string }) => MercadoPagoSdk;
  }
}

const URL_SDK = 'https://sdk.mercadopago.com/js/v2';

function carregarSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${URL_SDK}"]`);
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

export function CheckoutHoroscopo({
  pedidoId,
  chavePublica,
  valorEmReais,
  nomeProduto,
  modo,
}: {
  pedidoId: string;
  chavePublica: string;
  valorEmReais: number;
  nomeProduto: string;
  modo?: 'fake' | 'teste' | 'producao';
}) {
  const container = useRef<HTMLDivElement>(null);
  const jaMontou = useRef(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<Pix | null>(null);
  const [recusado, setRecusado] = useState('');
  const [emAnalise, setEmAnalise] = useState(false);

  useEffect(() => {
    evento('InitiateCheckout', { value: valorEmReais, currency: 'BRL' });
  }, [valorEmReais]);

  useEffect(() => {
    if (jaMontou.current) return;
    jaMontou.current = true;

    let controlador: { unmount(): void } | null = null;
    let cancelado = false;

    (async () => {
      try {
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return;

        const mp = new window.MercadoPago(chavePublica, { locale: 'pt-BR' });
        controlador = await mp.bricks().create('payment', 'brick-pagamento-horoscopo', {
          initialization: { amount: valorEmReais },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              bankTransfer: 'all',
              debitCard: [],
              ticket: [],
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
              const resposta = await fetch(`/api/horoscopo/pedido/${pedidoId}/pagamento`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData }),
              });
              const dados = await resposta.json();

              if (!resposta.ok) {
                setErro(dados.erro || 'Não deu para processar o pagamento.');
                throw new Error(dados.erro || 'falha');
              }
              if (dados.pix) {
                setPix(dados.pix);
                return;
              }
              const pendente = dados.status === 'pending' || dados.status === 'in_process';
              setEmAnalise(pendente);
              setRecusado(mensagemDeStatus(dados.status, dados.statusDetalhe));
            },
            onError: (e: unknown) => {
              console.error('[horoscopo/brick] erro:', e);
              setErro('Não conseguimos abrir o pagamento. Recarregue a página.');
            },
          },
        });
      } catch {
        if (!cancelado) setErro('Não conseguimos abrir o pagamento. Recarregue a página.');
      }
    })();

    return () => {
      cancelado = true;
      controlador?.unmount();
    };
  }, [pedidoId, chavePublica, valorEmReais]);

  if (pix) return <TelaPix pix={pix} pedidoId={pedidoId} />;
  if (emAnalise) return <TelaEmAnalise pedidoId={pedidoId} />;

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      {modo && modo !== 'producao' && <FaixaDeModo modo={modo} />}

      <div className="text-center flex flex-col items-center gap-3">
        <Flame className="text-vela" size={28} strokeWidth={1.5} />
        <h1 className="font-display italic text-2xl text-pergaminho">
          Os astros já sabem.
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/60">
          {`${nomeProduto} · R$ ${valorEmReais.toFixed(2).replace('.', ',')}`}
        </p>
      </div>

      {recusado && (
        <p className="font-corpo text-sm text-center text-vela/90 bg-vela/10 border border-vela/20 rounded-2xl px-4 py-3">
          {recusado}
        </p>
      )}
      {erro && <p className="font-corpo text-sm text-center text-red-300">{erro}</p>}

      <div id="brick-pagamento-horoscopo" ref={container} />

      <p className="font-corpo text-[11px] text-pergaminho/45 leading-relaxed max-w-[38ch] text-center mx-auto">
        Pagamento processado pelo Mercado Pago. Não guardamos o número do seu cartão.
      </p>
    </div>
  );
}

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

function TelaEmAnalise({ pedidoId }: { pedidoId: string }) {
  const pronto = useEsperaDoPagamento(pedidoId);
  if (pronto) return <TelaConfirmado />;
  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
      <Flame className="text-vela animate-pulse" size={32} strokeWidth={1.5} />
      <h1 className="font-display italic text-2xl text-pergaminho">
        Seu banco está conferindo.
      </h1>
      <p className="font-corpo font-light text-sm text-pergaminho/60 max-w-xs">
        Isso costuma levar alguns segundos. Deixe esta página aberta.
      </p>
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
        Abrindo o seu horóscopo...
      </p>
    </div>
  );
}

function useEsperaDoPagamento(pedidoId: string): boolean {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let vivo = true;
    const comecou = Date.now();

    const conferir = async () => {
      if (!vivo || Date.now() - comecou > 15 * 60_000) return;
      try {
        const r = await fetch(`/api/horoscopo/pedido/${pedidoId}`, { cache: 'no-store' });
        const d = await r.json();
        if (!vivo) return;
        if (d.status && d.status !== 'aguardando_pagamento') {
          setPronto(true);
          setTimeout(() => window.location.assign(`/horoscopo/revelacao/${pedidoId}`), 1200);
          return;
        }
      } catch {
        // rede instável não pode derrubar a tela
      }
      if (vivo) setTimeout(conferir, 4000);
    };

    const t = setTimeout(conferir, 4000);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [pedidoId]);

  return pronto;
}

function TelaPix({ pix, pedidoId }: { pix: Pix; pedidoId: string }) {
  const [copiado, setCopiado] = useState(false);
  const pronto = useEsperaDoPagamento(pedidoId);

  if (pronto) return <TelaConfirmado />;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
      <h1 className="font-display italic text-2xl text-pergaminho">Falta só o Pix.</h1>
      {pix.qrBase64 && (
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
        Deixe esta página aberta: assim que o pagamento cair, ela avança sozinha.
      </p>
    </div>
  );
}

function mensagemDeStatus(status: string, detalhe: string): string {
  if (status === 'pending' || status === 'in_process') {
    return 'Seu pagamento está em análise.';
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
