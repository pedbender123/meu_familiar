'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, Copy, Check } from 'lucide-react';

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
}: {
  pedidoId: string;
  chavePublica: string;
  valorEmReais: number;
  nomeProduto: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const jaMontou = useRef(false);
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<Pix | null>(null);
  const [recusado, setRecusado] = useState('');

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
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              bankTransfer: 'all', // Pix
              ticket: 'all', // boleto
            },
            visual: { style: { theme: 'dark' } },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: async ({ formData }: { formData: unknown }) => {
              setErro('');
              setRecusado('');
              const resposta = await fetch(`/api/pedido/${pedidoId}/pagamento`, {
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
              // pendente/recusado sem Pix: cartão negado, boleto emitido, etc.
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

  if (pix) return <TelaPix pix={pix} />;

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      <div className="text-center flex flex-col items-center gap-3">
        <Flame className="text-vela" size={28} strokeWidth={1.5} />
        <h1 className="font-display italic text-2xl text-pergaminho">
          Ele está esperando do outro lado.
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/60">
          {nomeProduto} · R$ {valorEmReais.toFixed(2).replace('.', ',')}
        </p>
      </div>

      {recusado && (
        <p className="font-corpo text-sm text-center text-vela/90 bg-vela/10 border border-vela/20 rounded-2xl px-4 py-3">
          {recusado}
        </p>
      )}
      {erro && (
        <p className="font-corpo text-sm text-center text-red-300">{erro}</p>
      )}

      <div id="brick-pagamento" ref={container} />
    </div>
  );
}

function TelaPix({ pix }: { pix: Pix }) {
  const [copiado, setCopiado] = useState(false);

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
        Assim que o pagamento cair, sua revelação começa a ser preparada — esta
        página não precisa ficar aberta.
      </p>
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
