import Link from 'next/link';
import { MarcoDeEntrada } from '@/components/landing/MarcoDeEntrada';
import { FunilDeVendas } from '@/app/atravessar/FunilDeVendas';

export const metadata = {
  title: 'Descubra seu familiar — Bruxário',
  description:
    'Descubra qual dos 12 animais guarda a sua natureza. Não é signo.',
};

export const dynamic = 'force-dynamic';

/**
 * A porta de entrada do tráfego pago. **É só o formulário.**
 *
 * ── Por que não tem mais nada aqui ────────────────────────────────────────
 *
 * Quem chega de um story já chegou curioso — a curiosidade é o combustível, e
 * ela é frágil. Toda seção extra (os doze, como funciona, "não é horóscopo",
 * fechamento, botão de login) dá ao cérebro material para começar a calcular
 * o que vem no fim ANTES de chegar lá. Isso troca curiosidade por ansiedade,
 * e ansiedade fecha aba.
 *
 * Então a página de vendas é a primeira cena, e o resto do funil é o próprio
 * ritual. Nada de imagem dos familiares, nada de explicação, nada de preço,
 * nada de "já tenho conta". A venda acontece lá no fim, quando a pessoa já
 * respondeu e recebeu o bilhete.
 *
 * ── A landing explicativa continua existindo, em `/` ──────────────────────
 *
 * Aquela é para quem digitou o endereço, foi indicado, ou quer entender antes
 * de decidir: explica o método, mostra os doze e compara os planos. As duas
 * servem gente em estados mentais diferentes — esta aqui serve quem ainda nem
 * decidiu que quer, e por isso não pode pedir nenhuma decisão.
 *
 * ── O que fica, e fica por obrigação ──────────────────────────────────────
 *
 * O micro-aviso de que é retrato simbólico (no `Hero`, colado na primeira
 * pergunta) e os links de Termos/Privacidade no rodapé. São exigência
 * legal e ficam no menor tamanho honesto — abaixo do formulário, sem competir
 * com ele, mas legíveis. Esconder isso não é minimalismo, é risco de estorno
 * e de bloqueio de anúncio.
 */
export default function Vendas() {
  return (
    <>
      <MarcoDeEntrada />
      <FunilDeVendas hero={<Hero />} rodape={<RodapeMinimo />} />
    </>
  );
}

/**
 * O título, e só enquanto a primeira pergunta está na tela.
 *
 * Depois da primeira resposta ele sai: a promessa já foi aceita, e daí em
 * diante ele só empurraria a pergunta para baixo da dobra no celular.
 */
function Hero() {
  return (
    <h1 className="font-display italic text-3xl sm:text-5xl leading-[1.12] text-pergaminho text-center text-balance max-w-[16ch] anima-surgir">
      Existe um familiar que já anda com você.
    </h1>
  );
}

function RodapeMinimo() {
  return (
    <div className="flex flex-col items-center gap-3 mt-12 pt-6 max-w-[42ch]">
      {/*
        O aviso desceu para cá.

        Ele estava colado no título, e três parágrafos antes da primeira
        pergunta empurravam o funil para baixo da dobra no celular — a pessoa
        chegava e via texto, não a coisa para fazer. A exigência é que ele
        seja acessível e legível, não que seja a primeira coisa lida; no
        rodapé ele cumpre as duas sem competir com a abertura.
      */}
      <p className="font-corpo text-[11px] leading-relaxed text-pergaminho/40 text-center">
        Retrato simbólico, não teste psicológico nem diagnóstico.
      </p>
      <div className="flex items-center gap-4">
        <Link href="/termos" className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition">
          Termos
        </Link>
        <span className="text-pergaminho/20">·</span>
        <Link href="/privacidade" className="font-corpo text-[11px] text-pergaminho/35 hover:text-pergaminho/60 transition">
          Privacidade
        </Link>
      </div>
    </div>
  );
}
