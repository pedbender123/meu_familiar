'use client';

import { useState } from 'react';
import { PRODUTOS } from '@/lib/produtos';
import type { PrecoFinal } from '@/lib/preco';

/**
 * As duas opções, depois da revelação parcial.
 *
 * ── Sobre a condição de lançamento ────────────────────────────────────────
 *
 * O valor riscado é o preço real de tabela, o mesmo dos Termos, e ele volta a
 * valer quando o cupom for desligado no painel. Preço-âncora inventado é
 * publicidade enganosa (CDC art. 37) — e é o atalho mais comum de página de
 * vendas com pressa.
 *
 * Também não há contador regressivo. A condição existe enquanto o cupom
 * existir, e nada nesta tela diz que ela some em dez minutos, porque não some.
 *
 * ── A Completa vem selecionada ────────────────────────────────────────────
 *
 * Antes eram dois cartões com um botão cada, e um TERCEIRO botão no rodapé
 * que levava para a Revelação. Três chamadas para ação, duas delas puxando
 * para o plano barato, e nenhuma dizendo qual é a recomendada — quem chega
 * indeciso trata isso como lição de casa e fecha a aba.
 *
 * Agora os cartões são uma escolha só, com a Completa já marcada, e existe um
 * único botão que leva o que estiver selecionado. Trocar de plano continua
 * custando um clique; a diferença é que não escolher também é uma resposta.
 *
 * O que continua NÃO existindo: a Revelação apresentada como escolha ruim.
 * Ela está listada com o mesmo peso, com o que entrega por inteiro, e o preço
 * das duas fica visível o tempo todo. Padrão que esconde a opção barata é
 * outra coisa, e não é isso.
 */
export function Oferta({
  pedidoId,
  descontoPercentual,
  precos,
  generoDoFamiliar,
}: {
  pedidoId: string;
  descontoPercentual: number;
  precos: { revelacao: PrecoFinal; completa: PrecoFinal };
  /** Sete dos doze familiares são femininos — o texto tem que concordar. */
  generoDoFamiliar?: 'm' | 'f';
}) {
  const ele = generoDoFamiliar === 'f' ? 'ela' : 'ele';
  const Ele = generoDoFamiliar === 'f' ? 'Ela' : 'Ele';
  const [indo, setIndo] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<'revelacao' | 'completa'>('completa');
  const [precosAtuais, setPrecosAtuais] = useState(precos);
  const [cupom, setCupom] = useState<{ codigo: string; gratis: boolean } | null>(
    null
  );

  const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

  async function escolher(produto: 'revelacao' | 'completa') {
    if (indo) return;
    setIndo(produto);
    // Dois marcos: o genérico (compatível com o histórico) e o do plano
    // escolhido — sem o segundo, não dá para saber qual dos dois puxa gente.
    try {
      const r = await fetch(`/api/pedido/${pedidoId}/escolher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ produto, cupom: cupom?.codigo }),
      });
      const d = await r.json();
      window.location.assign(d.redirect ?? `/pagamento/${pedidoId}`);
    } catch {
      setIndo(null);
    }
  }

  /**
   * Recalcula os dois cartões com o cupom digitado.
   *
   * A tela só mostra; quem decide o preço é o servidor, que revalida o código
   * na hora de criar a cobrança. Forjar a resposta desta chamada rende um
   * número bonito na tela e a cobrança certa no cartão.
   */
  async function aplicar(codigo: string): Promise<string | null> {
    const pedir = async (produto: 'revelacao' | 'completa') => {
      const r = await fetch('/api/cupom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, produto }),
      });
      return r.json();
    };

    const [a, b] = await Promise.all([pedir('revelacao'), pedir('completa')]);
    if (!a.ok) return a.erro || 'Esse cupom não vale.';

    setPrecosAtuais({
      revelacao: {
        cheioCentavos: a.cheioCentavos,
        finalCentavos: a.finalCentavos,
        descontoPercentual: a.descontoPercentual,
        gratis: a.gratis,
      },
      completa: {
        cheioCentavos: b.cheioCentavos,
        finalCentavos: b.finalCentavos,
        descontoPercentual: b.descontoPercentual,
        gratis: b.gratis,
      },
    });
    setCupom({ codigo: a.codigo, gratis: a.gratis });
    return null;
  }

  /**
   * O que cada plano entrega, em português de gente.
   *
   * A lista anterior dizia "leitura o dobro de longa" — mede a coisa errada.
   * Ninguém compra tamanho de texto; compra o que o texto responde. Aqui cada
   * linha diz uma pergunta que a leitura resolve, e a diferença entre os dois
   * planos aparece pelo CONTEÚDO, não pela contagem de parágrafos.
   *
   * Tudo listado é o que `produtos.ts` de fato libera — inclusive a narração,
   * que existia desde ontem e não estava escrita em lugar nenhum: quem comprava
   * a Completa descobria o áudio depois de pagar.
   */
  const cartoes = [
    {
      id: 'revelacao' as const,
      preco: precosAtuais.revelacao,
      itens: [
        `Quem é o seu familiar — o nome, o retrato e o nome secreto que só ${ele} te dá`,
        `A leitura escrita a partir das suas respostas: por que ${ele} te escolheu e o que veio te lembrar`,
        `O que o seu Sol e a sua Lua revelam através d${generoDoFamiliar === 'f' ? 'ela' : 'ele'}`,
        'PDF e as artes para compartilhar, no seu e-mail na hora',
      ],
      destaque: false,
    },
    {
      id: 'completa' as const,
      preco: precosAtuais.completa,
      itens: [
        'Tudo da Revelação, e a leitura vai mais fundo: a tensão que te puxa para dois lados, onde ela te custa caro, e o que você faz bem sem se dar crédito',
        'A leitura narrada em áudio, na voz do seu familiar',
        'Os gráficos do que o teste mediu: os quatro eixos e a sua posição entre os doze',
        'Seu perfil com link permanente — o da Revelação sai do ar em uma semana',
      ],
      destaque: true,
    },
  ];

  return (
    <section className="w-full max-w-lg flex flex-col items-center gap-5">
      {(descontoPercentual > 0 || cupom) && (
        <span className="font-corpo text-[0.65rem] tracking-[0.2em] uppercase text-vela border border-vela/40 rounded-full px-4 py-1.5">
          {cupom
            ? cupom.gratis
              ? 'É por nossa conta'
              : `Cupom ${cupom.codigo}`
            : 'Condição de lançamento'}
        </span>
      )}

      <div
        role="radiogroup"
        aria-label="Escolha o seu plano"
        className="w-full flex flex-col gap-3"
      >
        {cartoes.map((c) => {
          const produto = PRODUTOS[c.id];
          const marcado = escolhido === c.id;
          return (
            <div
              key={c.id}
              role="radio"
              tabIndex={0}
              aria-checked={marcado}
              onClick={() => setEscolhido(c.id)}
              onKeyDown={(e) => {
                // Espaço e Enter selecionam, como qualquer rádio nativo. Sem
                // isso o cartão é clicável só com mouse.
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setEscolhido(c.id);
                }
              }}
              className={[
                'rounded-2xl border px-5 py-5 flex flex-col gap-3 cursor-pointer transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vela/60',
                marcado
                  ? 'border-vela/70 bg-vela/[0.08]'
                  : 'border-pergaminho/18 hover:border-pergaminho/35',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display italic text-2xl text-pergaminho flex items-baseline gap-2">
                  <span
                    aria-hidden="true"
                    className={[
                      'shrink-0 size-4 self-center rounded-full border transition',
                      marcado
                        ? 'border-vela bg-vela shadow-[inset_0_0_0_3px_var(--tinta,#1a1410)]'
                        : 'border-pergaminho/35',
                    ].join(' ')}
                  />
                  {produto.nome}
                  {c.destaque && (
                    <span className="font-corpo text-[0.6rem] tracking-[0.18em] uppercase text-vela border border-vela/40 rounded-full px-2 py-0.5 self-center">
                      recomendada
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-2 shrink-0">
                  {c.preco.descontoPercentual > 0 && (
                    <span className="font-corpo text-sm text-pergaminho/40 line-through tabular-nums">
                      {brl(c.preco.cheioCentavos)}
                    </span>
                  )}
                  <span className="font-corpo text-2xl text-vela tabular-nums">
                    {c.preco.gratis ? 'grátis' : brl(c.preco.finalCentavos)}
                  </span>
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {c.itens.map((i) => (
                  <li
                    key={i}
                    className="font-corpo font-light text-sm text-pergaminho/70 leading-snug flex gap-2"
                  >
                    <span className="text-vela/70 shrink-0">·</span>
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => escolher(escolhido)}
        disabled={!!indo}
        className="w-full bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition disabled:opacity-40"
      >
        {indo
          ? 'Abrindo...'
          : `Continuar com a ${PRODUTOS[escolhido].nome} — ${
              precosAtuais[escolhido].gratis
                ? 'grátis'
                : brl(precosAtuais[escolhido].finalCentavos)
            }`}
      </button>

      <CampoDeCupom aoAplicar={aplicar} aplicado={!!cupom} />

      <p className="font-corpo font-light text-xs text-pergaminho/50 text-center max-w-[42ch] leading-relaxed">
        Pix ou cartão pelo Mercado Pago · acesso na hora · compra única, sem
        assinatura. Sua leitura é sobre quem você é: ela não expira e não muda
        amanhã.
      </p>

      <div className="flex flex-col items-center gap-3 pt-2 border-t border-pergaminho/10 w-full">
        <p className="font-display italic text-lg text-pergaminho/75 text-center max-w-[32ch] text-balance pt-5">
          {`${Ele} já te escolheu. A pergunta é se você quer ouvir o que ${ele} tem a dizer.`}
        </p>
        {/*
          O segundo botão saiu daqui. Ele levava para a Revelação — o plano
          mais barato — logo abaixo dos cartões, então a última coisa na tela
          contradizia a recomendação de cima. Agora o único botão é o dos
          cartões, e ele leva o que estiver selecionado.

          A frase "a carta acima continua sua" saiu antes disso: era verdade
          quando a arte aparecia de graça nesta tela, e virou mentira quando a
          arte passou para trás do pagamento. Prometer na página de compra uma
          coisa que não é entregue vira reclamação e estorno.
        */}
        <p className="font-corpo text-[11px] text-pergaminho/40 text-center max-w-[38ch] leading-relaxed">
          Sete dias para desistir e receber tudo de volta, sem precisar
          explicar.
        </p>
      </div>
    </section>
  );
}

/**
 * O campo de cupom, fechado por padrão.
 *
 * Campo de cupom aberto é abandono de carrinho conhecido: quem não tem código
 * sai da tela para procurar um e boa parte não volta. Atrás de um link
 * discreto, quem recebeu de um amigo acha na hora e quem não recebeu nem
 * repara.
 */
function CampoDeCupom({
  aoAplicar,
  aplicado,
}: {
  aoAplicar: (codigo: string) => Promise<string | null>;
  aplicado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState('');
  const [conferindo, setConferindo] = useState(false);

  if (aplicado) return null;

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="font-corpo text-xs text-pergaminho/45 hover:text-vela underline underline-offset-4 transition"
      >
        Tenho um cupom
      </button>
    );
  }

  async function conferir() {
    if (!valor.trim()) return;
    setErro('');
    setConferindo(true);
    setErro((await aoAplicar(valor)) ?? '');
    setConferindo(false);
  }

  return (
    <div className="w-full max-w-xs flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && conferir()}
          placeholder="SEUCUPOM"
          maxLength={24}
          aria-label="Código do cupom"
          className="flex-1 min-w-0 bg-transparent border border-pergaminho/25 rounded-lg px-4 py-2.5 font-corpo text-sm tracking-wider text-pergaminho placeholder:text-pergaminho/30 focus:border-vela focus:outline-none"
        />
        <button
          onClick={conferir}
          disabled={conferindo || !valor.trim()}
          className="font-corpo text-sm px-4 rounded-lg border border-vela/50 text-vela hover:bg-vela/10 transition disabled:opacity-40 shrink-0"
        >
          {conferindo ? '...' : 'Usar'}
        </button>
      </div>
      {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}
    </div>
  );
}
