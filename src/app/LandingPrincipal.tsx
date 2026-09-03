import Link from 'next/link';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { RodapeLegal } from '@/components/RodapeLegal';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import { DESCRICAO_DOS_EIXOS } from '@/lib/quiz/eixos';

/**
 * A landing na estética do grimório.
 *
 * A regra da direção vale aqui igual: o pergaminho é objeto dentro do quarto,
 * e o que é interface fica fora dele. A diferença em relação à revelação é que
 * aqui **não há uma folha só** — há a mesa com várias, porque a landing conta
 * o que o Bruxário é, e isso não cabe numa página.
 *
 * Duas coisas que a versão anterior não tinha e o SPEC exige:
 *  - **preço na tela** (0.3): "o dobro do preço precisa ser legível". Sem a
 *    tabela lado a lado, R$ 18,90 parece R$ 9,80 mais caro sem motivo.
 *  - **micro-aviso antes do quiz** (7.4), no momento em que a expectativa
 *    errada se forma — que é aqui, no botão, não num rodapé que ninguém lê.
 */
export function Landing() {
  return (
    <>
      <PoeiraNaLuz />
      <div className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center">
        <BarraDoTopo />
        <main className="w-full flex flex-col items-center gap-16 sm:gap-24 px-5 pb-8">
          <Abertura />
          <OsDoze />
          <OQueAcontece />
          <PortaDoMural />
          <OsProdutos />
          <OMetodo />
          <RodapeLegal />
        </main>
      </div>
    </>
  );
}

/**
 * A porta de entrada de quem JÁ é cliente. **Só existe aqui.**
 *
 * A `/vendas` foi despida de tudo que desvia atenção do formulário, e o link
 * de login foi junto. Sem esta barra, quem comprou a Completa não teria
 * nenhuma porta pelo site: o link mágico vai por e-mail e, passados os 30
 * dias da sessão, não sobraria caminho nenhum.
 */
function BarraDoTopo() {
  return (
    <div className="w-full max-w-3xl flex justify-end px-5 pt-5">
      <Link
        href="/entrar"
        className="font-corpo text-sm text-pergaminho/60 hover:text-vela transition-colors px-4 py-2 rounded-full border border-pergaminho/15 hover:border-vela/40"
      >
        Já tenho conta
      </Link>
    </div>
  );
}

/** Prova social: revelações reais de quem já passou pelo ritual. */
function PortaDoMural() {
  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-4 text-center">
      <h2 className="font-display italic text-3xl sm:text-4xl text-pergaminho text-balance">
        Quem já atravessou
      </h2>
      <p className="font-corpo font-light text-pergaminho/70 leading-relaxed max-w-[42ch]">
        As revelações que as pessoas escolheram tornar públicas, com o que elas
        escreveram depois de ler.
      </p>
      <Link
        href="/mural"
        className="font-corpo text-sm text-vela hover:brightness-125 underline underline-offset-4 transition"
      >
        Ver o mural
      </Link>
    </section>
  );
}

/* ── abertura ─────────────────────────────────────────────────────────── */

function Abertura() {
  return (
    <section className="w-full max-w-2xl flex flex-col items-center text-center gap-7">
      <Vela />

      <h1 className="font-display italic text-4xl sm:text-6xl leading-[1.1] text-pergaminho text-balance">
        Toda bruxa tem um familiar.
        <br />O seu já te escolheu.
      </h1>

      <p className="font-corpo font-light text-pergaminho/75 text-lg leading-relaxed max-w-md">
        Você só ainda não sabe qual é. {TOTAL_DE_ITENS} cenas revelam quem
        caminha ao seu lado — e o nome secreto que ele carrega só para você.
      </p>

      <div className="flex flex-col items-center gap-3 mt-1">
        <Link
          href="/ritual"
          className="inline-flex items-center gap-2.5 bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vela"
        >
          Começar o ritual
        </Link>
        {/*
          SPEC 7.4: o aviso aparece no momento em que a expectativa se forma, e
          é legível de verdade. Cinza-claro minúsculo aqui seria dark pattern —
          enfraquece o valor legal do aviso e lê como má-fé.
        */}
        <p className="font-corpo text-xs leading-relaxed text-pergaminho/55 max-w-[38ch]">
          É um retrato simbólico, não um teste psicológico. As perguntas se
          inspiram em modelos de personalidade estudados, mas o resultado é uma
          leitura de autoconhecimento — não um diagnóstico.
        </p>
      </div>
    </section>
  );
}

function Vela() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width="36" height="60" viewBox="0 0 40 66" aria-hidden="true">
        <ellipse cx="20" cy="60" rx="4" ry="4.5" fill="var(--vela)" opacity="0.35" />
        <rect x="18" y="42" width="4" height="18" rx="2" fill="var(--pergaminho)" opacity="0.8" />
        <g className="chama-tremula" style={{ transformOrigin: '20px 42px' }}>
          <path d="M20 6 C9 24, 6 34, 20 42 C34 34, 31 24, 20 6 Z" fill="var(--vela)" />
          <path
            d="M20 19 C14.5 29, 13.5 35, 20 39 C26.5 35, 25.5 29, 20 19 Z"
            fill="#FFF3D6"
            opacity="0.92"
          />
        </g>
      </svg>
      <span className="font-corpo text-[0.7rem] tracking-[0.28em] uppercase text-violeta">
        Bruxário
      </span>
    </div>
  );
}

/* ── os doze ──────────────────────────────────────────────────────────── */

/**
 * A vitrine são os **sigilos**, não os bichos.
 *
 * Mostrar as doze ilustrações entregaria o produto de graça e ainda faria a
 * pessoa escolher um favorito antes de responder — que é a pior coisa possível
 * para um teste. O sigilo mostra que existem doze e que são distintos entre si,
 * sem dizer qual é qual. Custo: zero, é geometria desenhada em Canvas.
 */
function OsDoze() {
  const ids = Object.keys(FAMILIARES) as FamiliarId[];

  return (
    <section className="w-full max-w-3xl flex flex-col items-center gap-7">
      <h2 className="font-display italic text-2xl sm:text-3xl text-pergaminho text-center text-balance">
        Doze sigilos. Um já é seu.
      </h2>

      <ul className="grid grid-cols-4 sm:grid-cols-6 gap-x-2 gap-y-4 place-items-center">
        {ids.map((id) => (
          <li key={id} className="opacity-70 hover:opacity-100 transition-opacity">
            <SigiloFamiliar
              sigilo={FAMILIARES[id].sigilo}
              tamanho={72}
              variante="quarto"
              animado={false}
            />
          </li>
        ))}
      </ul>

      <p className="font-corpo font-light text-sm text-pergaminho/50 text-center max-w-[40ch]">
        Cada familiar traça o seu, sempre igual. Você vê o seu inteiro no fim do
        ritual.
      </p>
    </section>
  );
}

/* ── o que acontece ───────────────────────────────────────────────────── */

const PASSOS = [
  {
    titulo: 'Você responde',
    texto: `${TOTAL_DE_ITENS} cenas, sem resposta certa. Leva uns cinco minutos e ninguém te pergunta se você é assertiva — te colocam numa sala em que alguém precisa falar primeiro.`,
  },
  {
    titulo: 'Ele te encontra',
    texto:
      'O resultado sai das suas escolhas, e o seu Sol e a sua Lua entram na leitura que ele escreve sobre você.',
  },
  {
    titulo: 'Fica com você',
    texto:
      'A revelação abre no seu Bruxário na hora, com as imagens prontas pra postar, e o link chega também no seu e-mail. Se quiser um endereço permanente e o perfil completo, é a Completa que faz isso.',
  },
];

function OQueAcontece() {
  return (
    <section className="w-full flex flex-col items-center">
      <FolhaPergaminho>
        <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center">
          Como funciona
        </h2>
        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <ol className="flex flex-col gap-7 self-stretch max-w-[54ch] mx-auto">
          {PASSOS.map((passo, i) => (
            <li key={passo.titulo} className="flex gap-4">
              <span
                aria-hidden="true"
                className="font-display italic text-2xl text-ouro-velho leading-none pt-0.5 shrink-0"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-corpo font-medium text-sm tracking-wide text-escrita">
                  {passo.titulo}
                </h3>
                <p className="font-corpo font-light text-escrita-corpo leading-relaxed">
                  {passo.texto}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </FolhaPergaminho>
    </section>
  );
}

/* ── os produtos ──────────────────────────────────────────────────────── */

/**
 * O que é grátis e o que se paga.
 *
 * ── Por que a tabela comparativa saiu ─────────────────────────────────────
 *
 * Ela comparava Revelação (R$ 9,80) com Completa (R$ 18,90) — duas compras
 * avulsas. Desde agosto/2026 a Revelação é grátis e o que se vende é
 * assinatura, então a tabela passou a comparar coisas que não existem mais.
 *
 * O que entra no lugar é mais simples de ler e mais honesto de vender: o que
 * você leva sem pagar, e o que a assinatura abre. Os preços NÃO são
 * repetidos aqui — quem quer valor vai em /planos, onde eles saem dos
 * direitos reais dos planos. Preço escrito à mão em dois lugares é preço que
 * um dia diverge.
 */
function OsProdutos() {
  return (
    <section className="w-full max-w-2xl flex flex-col items-center gap-8">
      <h2 className="font-display italic text-2xl sm:text-3xl text-pergaminho text-center text-balance">
        O ritual é de graça.
      </h2>

      <div className="w-full grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-pergaminho/12">
          <p className="font-corpo text-[0.58rem] tracking-[0.22em] uppercase text-pergaminho/35">
            sem pagar nada
          </p>
          <ul className="flex flex-col gap-2">
            {[
              'O seu familiar, revelado',
              'A leitura e as imagens, no seu Bruxário',
              'Sua conta no Bruxário, para sempre',
              'Uma leitura do Oráculo por mês',
              'O calendário da sua semana',
            ].map((item) => (
              <li
                key={item}
                className="font-corpo font-light text-sm text-pergaminho/70 leading-snug"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex flex-col gap-3 p-5 rounded-2xl border"
          style={{
            borderColor: 'rgba(217,164,65,0.4)',
            background: 'linear-gradient(165deg, rgba(217,164,65,0.08), transparent)',
          }}
        >
          <p className="font-corpo text-[0.58rem] tracking-[0.22em] uppercase text-vela">
            com assinatura
          </p>
          <ul className="flex flex-col gap-2">
            {[
              'O Oráculo respondendo todo dia',
              'Leituras completas, com as cartas e o céu',
              'O calendário do mês e do ano inteiro',
              'O retrato completo de quem você é',
              'Sua leitura narrada em áudio',
            ].map((item) => (
              <li
                key={item}
                className="font-corpo font-light text-sm text-pergaminho/80 leading-snug"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="font-corpo font-light text-xs text-pergaminho/45 text-center max-w-[42ch] leading-relaxed">
        Você conhece o seu familiar primeiro. Só decide se quer o resto
        depois — e o que já é seu continua seu de qualquer jeito.
      </p>

      <Link
        href="/planos"
        className="font-corpo text-sm text-vela hover:brightness-125 transition"
      >
        ver os planos →
      </Link>
    </section>
  );
}

/* ── o método ─────────────────────────────────────────────────────────── */

/**
 * SPEC 7.5-C: a página pública de método. Não é obrigação legal — é a peça que
 * responde de antemão à acusação de picaretagem, e vale mais que qualquer
 * disclaimer.
 *
 * Está resumida aqui na landing porque a página inteira ainda não existe. Os
 * números de consistência da seção 2.5 entram quando houver base.
 */
function OMetodo() {
  return (
    <section className="w-full flex flex-col items-center">
      <FolhaPergaminho>
        <h2 className="font-display italic text-2xl sm:text-3xl text-escrita text-center text-balance">
          Por que isto não é chute
        </h2>
        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <p className="font-corpo font-light text-escrita-corpo leading-relaxed max-w-[58ch] text-center">
          O ritual mede duas coisas, e são duas coisas que a psicologia da
          personalidade estuda há décadas — os dois eixos do circumplexo
          interpessoal:
        </p>

        <dl className="flex flex-col sm:flex-row gap-6 sm:gap-10 max-w-[58ch]">
          {(['agencia', 'comunhao'] as const).map((eixo) => (
            <div key={eixo} className="flex-1 flex flex-col gap-1.5">
              <dt className="font-corpo font-medium text-sm tracking-wide text-escrita">
                {DESCRICAO_DOS_EIXOS[eixo].nome}
              </dt>
              <dd className="font-corpo font-light text-sm text-escrita-corpo leading-relaxed">
                {DESCRICAO_DOS_EIXOS[eixo].explicacao}
              </dd>
            </div>
          ))}
        </dl>

        <p className="font-corpo font-light text-escrita-corpo leading-relaxed max-w-[58ch] text-center">
          Os doze familiares ficam em volta de um círculo, e o seu é aquele mais
          perto de onde as suas respostas caíram. O signo tem peso{' '}
          <strong className="font-medium">zero</strong> nessa conta.
        </p>

        <p className="font-corpo font-light text-sm text-escrita-fraca leading-relaxed max-w-[54ch] text-center">
          E o que ele <em>não</em> é: não é instrumento psicométrico validado,
          não é diagnóstico, não prevê o futuro.
        </p>
      </FolhaPergaminho>
    </section>
  );
}
