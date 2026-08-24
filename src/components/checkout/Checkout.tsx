'use client';

import { useState } from 'react';
import { QrCode, CreditCard } from 'lucide-react';
import { CheckoutMercadoPago } from './MercadoPago';
import { CheckoutCaktoPix } from './Cakto';
import { CheckoutWiven } from './Wiven';
import { marcar } from '@/lib/marcar';

/**
 * A tela de pagamento: escolhe o meio, e só então o gateway daquele meio.
 *
 * ── Por que Pix vem selecionado ───────────────────────────────────────────
 *
 * Antes, o Brick chegava com Pix e cartão lado a lado e a pessoa decidia.
 * Cartão numa compra de impulso de R$ 9,80 pede número, validade, CVV, nome
 * do titular e CPF — cinco campos e a carteira na mão, depois de treze
 * minutos de ritual. Pix é um botão e o aplicativo do banco.
 *
 * O cartão não sumiu: continua a um clique. Mas quem não escolhe, cai no
 * caminho curto — e "quem não escolhe" é a maioria.
 *
 * ── Por que o gateway é decidido lá em cima ───────────────────────────────
 *
 * O servidor resolve `gatewayPix` e `gatewayCartao` a cada visita
 * (`gatewayDe()`), então este componente nunca lê variável de ambiente e
 * nunca decide quem cobra. Ele só sabe despachar. Trocar o Pix de gateway é
 * um restart, não um deploy — e a tabela abaixo é o único lugar que precisa
 * ganhar uma linha quando um gateway novo entra.
 *
 * ── Por que um Brick de cada vez ──────────────────────────────────────────
 *
 * O Brick monta dentro de `#brick-pagamento`, que é um só. Montar dois
 * disputaria o mesmo nó. O `key` por meio força desmontar um antes de montar
 * o outro, e o `unmount()` do controlador roda na limpeza do efeito.
 */

export type MeioEscolhido = 'pix' | 'cartao';

/** Quem cobra cada meio. Vem do servidor, resolvido por `gatewayDe()`. */
export type GatewayDoMeio = 'mercadopago' | 'cakto' | 'wiven';

export function Checkout({
  pedidoId,
  chavePublica,
  valorEmReais,
  nomeProduto,
  generoDoFamiliar,
  itens,
  cupom,
  modo,
  nome,
  cpf,
  gatewayPix,
  gatewayCartao,
  base = 'pedido',
  caminho = 'pagamento',
  destino,
}: {
  pedidoId: string;
  chavePublica: string;
  valorEmReais: number;
  nomeProduto: string;
  generoDoFamiliar?: 'm' | 'f';
  itens?: string[];
  cupom?: { codigo: string; descontoPercentual: number; cheioEmReais: number };
  modo?: 'fake' | 'teste' | 'producao';
  /** Para o Pix fora do Brick, que pede pagador identificado. */
  nome: string;
  cpf: string | null;
  gatewayPix: GatewayDoMeio;
  gatewayCartao: GatewayDoMeio;
  base?: 'pedido' | 'cobranca';
  caminho?: 'pagamento' | 'melhorar';
  destino?: string;
}) {
  const [meio, setMeio] = useState<MeioEscolhido>('pix');
  const gatewayDoMeio = meio === 'pix' ? gatewayPix : gatewayCartao;

  function escolher(novo: MeioEscolhido) {
    if (novo === meio) return;
    setMeio(novo);
    // Qual meio a pessoa escolheu é metade da leitura do funil: se o cartão
    // for muito clicado e pouco pago, o problema é o formulário, não o preço.
    marcar(novo === 'pix' ? 'checkout_pix' : 'checkout_cartao');
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Forma de pagamento"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-pergaminho/12 p-1.5"
      >
        <Aba
          ativa={meio === 'pix'}
          aoClicar={() => escolher('pix')}
          icone={<QrCode size={16} strokeWidth={1.5} />}
          rotulo="Pix"
          detalhe="Na hora"
        />
        <Aba
          ativa={meio === 'cartao'}
          aoClicar={() => escolher('cartao')}
          icone={<CreditCard size={16} strokeWidth={1.5} />}
          rotulo="Cartão"
          detalhe="À vista"
        />
      </div>

      {/*
        A troca de aba desmonta um formulário e monta outro — o cartão do
        Mercado Pago tem seis campos, o Pix tem um QR Code. A altura muda de
        uma vez, e sem isto a página dá um solavanco de uns 300px justamente
        no clique em que a pessoa está decidindo pagar.

        `key` no wrapper reinicia a animação a cada troca; a opacidade e os
        8px de deslocamento fazem o bloco novo *chegar* em vez de aparecer.
        Quem pediu menos movimento no sistema não recebe nenhum.
      */}
      <div key={`painel-${meio}`} className="painel-do-checkout">
      {/*
        A tabela de despacho. Um gateway novo é uma linha aqui e uma no
        `provedorDe` — nada mais no caminho da compra precisa saber que ele
        existe.
      */}
      {gatewayDoMeio === 'wiven' ? (
        <CheckoutWiven
          key={`wiven-${meio}`}
          pedidoId={pedidoId}
          meio={meio}
          valorEmReais={valorEmReais}
          nome={nome}
          cpf={cpf}
          itens={itens}
          destino={destino}
        />
      ) : meio === 'pix' && gatewayPix === 'cakto' ? (
        <CheckoutCaktoPix
          key="pix-cakto"
          pedidoId={pedidoId}
          valorEmReais={valorEmReais}
          nome={nome}
          cpf={cpf}
        />
      ) : (
        <CheckoutMercadoPago
          key={`mp-${meio}`}
          meios={[meio]}
          pedidoId={pedidoId}
          chavePublica={chavePublica}
          valorEmReais={valorEmReais}
          nomeProduto={nomeProduto}
          generoDoFamiliar={generoDoFamiliar}
          itens={itens}
          cupom={cupom}
          modo={modo}
          base={base}
          caminho={caminho}
          destino={destino}
        />
      )}
      </div>
    </div>
  );
}

function Aba({
  ativa,
  aoClicar,
  icone,
  rotulo,
  detalhe,
}: {
  ativa: boolean;
  aoClicar: () => void;
  icone: React.ReactNode;
  rotulo: string;
  detalhe: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={aoClicar}
      className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 transition-colors ${
        ativa
          ? 'bg-vela/15 text-pergaminho border border-vela/35'
          : 'text-pergaminho/55 border border-transparent hover:text-pergaminho/80'
      }`}
    >
      <span className={ativa ? 'text-vela' : 'text-pergaminho/40'}>{icone}</span>
      <span className="flex flex-col items-start leading-tight">
        <span className="font-corpo text-[13px]">{rotulo}</span>
        <span className="font-corpo font-light text-[10px] text-pergaminho/45">{detalhe}</span>
      </span>
    </button>
  );
}
