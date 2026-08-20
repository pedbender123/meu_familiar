'use client';

import { useEffect, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { CirculoMagico } from '@/components/CirculoMagico';
import { evento } from '@/lib/pixel';

const MENSAGENS = [
  'Seu familiar está atravessando o véu...',
  'As sombras se organizam ao redor do seu nome...',
  'A lua confere seus signos em silêncio...',
  'Faltam poucos passos para o encontro...',
];

export default function Obrigado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mensagemIndice, setMensagemIndice] = useState(0);
  const [erro, setErro] = useState(false);
  // `null` = ainda não sabemos. Sem isso o campo pisca na tela de quem já deu
  // o e-mail, no intervalo entre o primeiro render e o primeiro poll.
  const [precisaEmail, setPrecisaEmail] = useState<boolean | null>(null);
  const disparouCompra = useRef(false);

  /**
   * Dispara o `Purchase` AQUI, e não só em `/revelacao/[id]`.
   *
   * `/revelacao` só reconhece a dona por sessão logada, e não há login
   * automático depois de pagar. Quem fecha esta aba ou só abre o e-mail
   * depois nunca dispararia o evento, e uma venda real sumiria do Ads
   * Manager. Esta aba É a pessoa que pagou, sem precisar provar nada.
   *
   * ── O `event_id` é o que conserta a contagem tripla ───────────────────
   *
   * Antes este disparo saía SEM id, e a única trava era `localStorage` — que
   * é por navegador. Quem pagava no app do Instagram, abria o e-mail no
   * Chrome e depois olhava no computador tinha três memórias diferentes e
   * gerava três vendas para um pagamento. Com `${id}:purchase`, os três
   * chegam à Meta como o mesmo acontecimento e ela conta um.
   */
  function dispararCompraSeNecessario(
    status: string,
    valorCentavos: number | undefined,
    exemplo: boolean | undefined
  ) {
    if (disparouCompra.current) return;
    if (status === 'aguardando_pagamento' || exemplo) return;
    disparouCompra.current = true;

    const chave = `bx_compra_${id}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, '1');
    } catch {
      // Sem storage: dispara mesmo assim. Quem impede a contagem dobrada é o
      // `event_id`, não esta trava.
    }
    evento('Purchase', { value: (valorCentavos ?? 0) / 100, currency: 'BRL' }, `${id}:purchase`);
  }

  useEffect(() => {
    const rotacao = setInterval(() => {
      setMensagemIndice((i) => (i + 1) % MENSAGENS.length);
    }, 3200);
    return () => clearInterval(rotacao);
  }, []);

  useEffect(() => {
    let ativo = true;
    const poll = setInterval(async () => {
      try {
        const resposta = await fetch(`/api/pedido/${id}`);
        const dados = await resposta.json();
        if (!ativo) return;
        const faltaEmail = !dados.temEmail;
        setPrecisaEmail((antes) => (antes === false ? false : faltaEmail));
        dispararCompraSeNecessario(dados.status, dados.valorCentavos, dados.exemplo);

        if (dados.status === 'entregue') {
          clearInterval(poll);
          /**
           * O destino vem do SERVIDOR (`dados.destino`).
           *
           * No modelo novo é a oferta de três degraus — o único momento de
           * atenção total da pessoa, com a revelação a um clique dali. No
           * modelo antigo é a revelação direto, porque ela pagou por isso.
           *
           * Quem decide é o interruptor, no servidor: assim virar a chave não
           * precisa de deploy, e o navegador nunca fica com a regra velha
           * congelada no pacote.
           */
          router.push(dados.destino ?? `/revelacao/${id}`);
          return;
        }

        /**
         * Pago, com endereço, e as 26 cenas ainda não respondidas: o produto
         * está do outro lado do ritual, não desta espera.
         *
         * Sem isto a pessoa ficava no círculo girando para sempre — o pedido
         * nunca chegaria a `entregue`, porque `processarPedido` só roda quando
         * `ritual_completo` vira 1. Era o beco sem saída do funil novo.
         *
         * O e-mail vem antes de propósito: é um campo, ela está na tela, e
         * depois do ritual ela vai direto para a revelação — pedir lá seria
         * atravessar o melhor momento do produto com um formulário.
         */
        if (!dados.ritualCompleto && !faltaEmail) {
          clearInterval(poll);
          router.push(`/ritual/${id}`);
          return;
        }

        if (dados.status === 'erro') setErro(true);
      } catch {
        // silencioso — tenta de novo no próximo ciclo
      }
    }, 2000);
    return () => {
      ativo = false;
      clearInterval(poll);
    };
  }, [id, router]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-8 text-center">
      <CirculoMagico />
      <h1 className="font-display italic text-2xl text-pergaminho max-w-sm">
        {erro
          ? 'O véu está denso esta noite — atualize esta página em instantes.'
          : precisaEmail
            ? 'Pago. Falta uma coisa só.'
            : MENSAGENS[mensagemIndice]}
      </h1>
      {precisaEmail && <PedeEmail id={id} onPronto={() => setPrecisaEmail(false)} />}

      {!erro && !precisaEmail && (
        <p className="font-corpo font-light text-sm text-pergaminho/60">
          Isso pode levar um minuto. Não feche esta página.
        </p>
      )}
    </main>
  );
}

/**
 * O endereço de entrega, pedido depois do pagamento.
 *
 * Quem veio do funil de anúncio sem aceitar os termos comprou com dois campos
 * preenchidos. Aqui a pergunta se paga sozinha: ela já pagou, e "para onde eu
 * mando?" é o passo natural — o mesmo campo que antes da compra seria um
 * pedágio agora é o que falta para receber.
 *
 * A geração continua rodando por trás enquanto ela digita; o e-mail só decide
 * para onde o resultado vai, não se ele existe.
 */
function PedeEmail({ id, onPronto }: { id: string; onPronto: () => void }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState('');

  async function enviar() {
    if (!email.trim() || enviando) return;
    setEnviando(true);
    setFalha('');
    try {
      const r = await fetch(`/api/pedido/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setFalha(d.erro || 'Não consegui guardar. Tente de novo.');
        setEnviando(false);
        return;
      }
      onPronto();
    } catch {
      setFalha('O véu está denso. Tente de novo em instantes.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <p className="font-corpo font-light text-sm text-pergaminho/70 leading-relaxed">
        Para onde eu mando o seu familiar quando ele atravessar?
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()}
          placeholder="seu@email.com"
          autoComplete="email"
          autoFocus
          className="flex-1 bg-transparent border border-pergaminho/25 rounded-xl px-4 py-3 text-pergaminho placeholder:text-pergaminho/30 focus:border-vela outline-none font-corpo"
        />
        <button
          onClick={enviar}
          disabled={!email.trim() || enviando}
          className="bg-vela text-tinta font-corpo font-medium px-5 rounded-xl hover:brightness-110 transition disabled:opacity-40"
        >
          {enviando ? '...' : 'Enviar'}
        </button>
      </div>
      {falha && <p className="font-corpo text-xs text-red-400">{falha}</p>}
      <p className="font-corpo text-[11px] text-pergaminho/40 leading-relaxed">
        A revelação também fica guardada neste endereço da página — o e-mail é
        para você não depender dele.
      </p>
    </div>
  );
}
