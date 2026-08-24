import Link from 'next/link';
import { Suspense } from 'react';
import { ordemEmbaralhada, itensNaOrdemDeExibicao } from '@/lib/quiz/ordem';
import { PRODUTO_PADRAO } from '@/lib/produtos';
import { RitualCliente } from './ritual/RitualCliente';

/**
 * As 26 cenas **sem landing na frente**.
 *
 * ── O que mudou, e por quê ────────────────────────────────────────────────
 *
 * O funil `padrao` — o único que já vendeu — era "landing explicativa e
 * depois as 26 cenas". A landing contava os doze familiares, explicava o
 * método, mostrava a tabela de planos, e só então oferecia um botão. Isso é
 * material demais para quem ainda não decidiu nada: dá ao cérebro tudo o que
 * ele precisa para calcular o que vem no fim ANTES de chegar lá, e quem
 * calcula fecha a aba.
 *
 * A `/vendas` já tinha recebido esse tratamento para o funil de sete
 * perguntas, e a lição de lá vale aqui igual: a página de vendas É a primeira
 * cena. Nada de imagem dos familiares, nada de preço, nada de "já tenho
 * conta". A venda acontece no fim, quando a pessoa já respondeu e já viu o
 * familiar dela.
 *
 * ── A landing continua existindo, e continua sendo necessária ─────────────
 *
 * Em `/` puro, sem marcador de campanha: é a via de volta de quem digitou o
 * endereço, foi indicado, ou já é cliente e precisa do link de login. Esta
 * porta aqui serve o oposto — tráfego frio, que não pode receber nenhuma
 * pergunta que não seja a primeira cena.
 *
 * ── O que fica, e fica por obrigação ──────────────────────────────────────
 *
 * O micro-aviso de retrato simbólico (SPEC 7.4) e os links de Termos e
 * Privacidade, no rodapé, em corpo pequeno mas legível. Esconder isso não é
 * minimalismo: é risco de estorno e de bloqueio da conta de anúncio.
 */
export function PortaDoRitual() {
  return (
    <Suspense fallback={null}>
      <RitualCliente
        itens={itensNaOrdemDeExibicao()}
        ordemDasOpcoes={ordemEmbaralhada()}
        produtoPadrao={PRODUTO_PADRAO}
        hero={<Hero />}
        rodape={<RodapeMinimo />}
      />
    </Suspense>
  );
}

/**
 * O título, e só enquanto a primeira cena está na tela.
 *
 * Depois da primeira resposta ele sai: a promessa já foi aceita, e daí em
 * diante ele só empurraria a pergunta para baixo da dobra no celular.
 */
function Hero() {
  return (
    <div className="flex flex-col items-center gap-3 anima-surgir">
      <h1 className="font-display italic text-3xl sm:text-5xl leading-[1.12] text-pergaminho text-center text-balance max-w-[16ch]">
        Toda bruxa tem um familiar. O seu já te escolheu.
      </h1>
      {/*
        O contrato, numa linha.

        Antes não existia: a pessoa caía numa pergunta abstrata sem saber
        quantas vinham, quanto tempo levava, nem o que ganhava no fim. A barra
        de progresso aparece quase vazia e sem número, então ela também não
        respondia isso. Um ritual de 26 cenas sem contrato é um cheque em
        branco pedido a alguém que chegou há dois segundos.

        Dizer o tamanho ANTES parece contra-intuitivo — "26 vai assustar" —,
        mas o que assusta de verdade é não saber onde acaba. O número vem
        acompanhado do tempo e da entrega, que é o que o torna aceitável.
      */}
      <p className="font-corpo text-[0.8rem] leading-relaxed text-pergaminho/55 text-center max-w-[34ch]">
        26 cenas, uns 3 minutos. No fim, você vê quem é o seu familiar.
      </p>
    </div>
  );
}

function RodapeMinimo() {
  return (
    <div className="flex flex-col items-center gap-3 mt-10 pt-4 max-w-[42ch]">
      <p className="font-corpo text-[11px] leading-relaxed text-pergaminho/40 text-center">
        Retrato simbólico, não teste psicológico nem diagnóstico.
      </p>
      <div className="flex items-center gap-4">
        <Link
          href="/termos"
          className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition"
        >
          Termos
        </Link>
        <span className="text-pergaminho/20">·</span>
        <Link
          href="/privacidade"
          className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition"
        >
          Privacidade
        </Link>
      </div>
    </div>
  );
}
