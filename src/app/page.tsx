import Link from 'next/link';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { RodapeLegal } from '@/components/RodapeLegal';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import {
  PRODUTOS,
  PRODUTOS_PRINCIPAIS,
  precoFormatado,
  type Produto,
} from '@/lib/produtos';
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
export default function Landing() {
  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-16 sm:gap-24 px-5 pt-14 pb-8 sm:pt-20">
        <Abertura />
        <OsDoze />
        <OQueAcontece />
        <OsProdutos />
        <OMetodo />
        <RodapeLegal />
      </main>
    </>
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
      'O resultado sai das suas escolhas, não do seu signo. O Sol e a Lua entram depois, como textura da leitura — nunca na conta.',
  },
  {
    titulo: 'Fica com você',
    texto:
      'A revelação vem em PDF e em imagens prontas pra postar, e chega também no seu e-mail. Se quiser um endereço permanente e o perfil no Bruxário, é a Completa que faz isso.',
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
 * SPEC 0.3: "o dobro do preço precisa ser legível na tela".
 *
 * A tabela é gerada de `lib/produtos.ts`, então não existe o caso de a tela
 * prometer o que o backend não libera — se alguém tirar a roda dos 12 da
 * Completa no código, ela some daqui junto.
 */
const LINHAS: { rotulo: string; de: (p: Produto) => boolean | string }[] = [
  { rotulo: 'Seu familiar e a leitura', de: () => true },
  { rotulo: 'PDF e imagens pra compartilhar', de: (p) => p.pdf && p.imagens },
  {
    rotulo: 'Quanto tempo o link dura',
    de: (p) =>
      p.diasDeAcesso === null ? 'para sempre' : `${p.diasDeAcesso} dias`,
  },
  { rotulo: 'Leitura longa', de: (p) => p.relatorioCompleto },
  { rotulo: 'Gráficos do seu perfil', de: (p) => p.graficos },
  { rotulo: 'Perfil público com link próprio', de: (p) => p.perfilPublico },
  { rotulo: 'Tiragem diária', de: (p) => p.tiragemDiaria },
  {
    rotulo: 'Consultas ao Oráculo no lançamento',
    de: (p) => (p.perguntasOraculo > 0 ? `${p.perguntasOraculo}` : false),
  },
];

function OsProdutos() {
  const lista = PRODUTOS_PRINCIPAIS;

  return (
    <section className="w-full max-w-2xl flex flex-col items-center gap-6">
      <h2 className="font-display italic text-2xl sm:text-3xl text-pergaminho text-center">
        O que você leva
      </h2>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse font-corpo text-sm min-w-[22rem]">
          <thead>
            <tr>
              <th className="w-1/2" />
              {lista.map((p) => (
                <th key={p.id} className="pb-4 px-2 text-center align-bottom">
                  <span className="block font-display italic text-lg text-pergaminho font-normal">
                    {p.nome}
                  </span>
                  <span className="block font-corpo text-vela text-base mt-0.5 tabular-nums">
                    {/* nó de texto único: `R$ {valor}` viraria dois nós com um
                        comentário do React no meio, o que atrapalha seleção e
                        leitores de tela */}
                    {`R$ ${precoFormatado(p)}`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map(({ rotulo, de }) => (
              <tr key={rotulo} className="border-t border-pergaminho/10">
                <td className="py-3 pr-3 font-light text-pergaminho/75">{rotulo}</td>
                {lista.map((p) => {
                  const valor = de(p);
                  return (
                    <td key={p.id} className="py-3 px-2 text-center tabular-nums">
                      {valor === true ? (
                        <span className="text-vela" aria-label="incluído">
                          ✦
                        </span>
                      ) : valor === false ? (
                        <span className="text-pergaminho/25" aria-label="não incluído">
                          —
                        </span>
                      ) : (
                        <span className="text-pergaminho/85">{valor}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-corpo font-light text-xs text-pergaminho/50 text-center max-w-[42ch]">
        Você escolhe o plano depois de conhecer seu familiar. Quem levar a
        Revelação e quiser guardar o link para sempre pode fazer isso depois,
        por {`R$ ${precoFormatado(PRODUTOS.link_permanente)}`}.
      </p>
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
