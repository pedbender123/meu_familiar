import Link from 'next/link';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { PRODUTOS, precoFormatado } from '@/lib/produtos';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import { precoComDesconto } from '@/lib/cupons';

/**
 * Peças comuns às páginas de vendas.
 *
 * ── A regra que vale em todas as variantes ────────────────────────────────
 *
 * O aviso de que **não é teste psicológico** aparece antes do primeiro botão,
 * em tamanho legível, em todas elas. Não é cerimônia jurídica: é a linha que
 * separa "página que convence" de "página que engana", e ela é o que permite
 * o resto do texto ser ousado sem virar promessa falsa.
 *
 * Nenhuma variante inventa urgência que não existe. Não há contador regressivo
 * mentiroso, não há "restam 3 vagas", não há preço "de/por" com valor cheio
 * fabricado — o valor riscado é o preço real de tabela, que continua valendo
 * quando a condição de lançamento acabar.
 */

export { CUPOM_DE_LANCAMENTO } from '@/lib/lancamento';

/* ── vela ──────────────────────────────────────────────────────────────── */

export function Vela({ pequena = false }: { pequena?: boolean }) {
  const t = pequena ? { l: 26, a: 44 } : { l: 36, a: 60 };
  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width={t.l} height={t.a} viewBox="0 0 40 66" aria-hidden="true">
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

/* ── o aviso ───────────────────────────────────────────────────────────── */

/**
 * O micro-aviso, colado no botão.
 *
 * Fica **antes** do clique porque é ali que a expectativa errada se forma.
 * Num rodapé ele existiria só para nos defender; aqui ele informa de verdade —
 * e, por isso, vale muito mais se alguém questionar.
 */
export function AvisoHonesto({ curto = false }: { curto?: boolean }) {
  return (
    <p className="font-corpo text-xs leading-relaxed text-pergaminho/55 max-w-[40ch] text-center">
      {curto
        ? 'Retrato simbólico e entretenimento — não é teste psicológico nem diagnóstico.'
        : 'É um retrato simbólico, não um teste psicológico. As perguntas se inspiram em modelos de personalidade estudados, mas o resultado é uma leitura de autoconhecimento — não um diagnóstico.'}
    </p>
  );
}

/* ── botão ─────────────────────────────────────────────────────────────── */

export function BotaoRitual({
  texto = 'Começar o ritual',
  destino = '/ritual',
}: {
  texto?: string;
  destino?: string;
}) {
  return (
    <Link
      href={destino}
      data-cta="ritual"
      className="inline-flex items-center justify-center gap-2.5 bg-vela text-tinta font-corpo font-medium text-base px-9 py-4 rounded-full hover:brightness-110 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vela"
    >
      {texto}
    </Link>
  );
}

/* ── os doze sigilos ───────────────────────────────────────────────────── */

/**
 * A vitrine são os **sigilos**, não os bichos.
 *
 * Mostrar as doze ilustrações entregaria o produto de graça e ainda faria a
 * pessoa escolher um favorito antes de responder — a pior coisa possível para
 * um teste. O sigilo prova que existem doze e que são distintos, sem dizer
 * qual é qual.
 */
export function OsDoze({ titulo }: { titulo?: string }) {
  const ids = Object.keys(FAMILIARES) as FamiliarId[];
  return (
    <section className="w-full max-w-2xl flex flex-col items-center gap-6">
      {titulo && (
        <h2 className="font-display italic text-2xl sm:text-3xl text-pergaminho text-center text-balance">
          {titulo}
        </h2>
      )}
      <ul className="grid grid-cols-4 sm:grid-cols-6 gap-y-6 gap-x-4">
        {ids.map((id) => (
          <li key={id} className="flex justify-center">
            <SigiloFamiliar sigilo={FAMILIARES[id].sigilo} tamanho={52} variante="quarto" />
          </li>
        ))}
      </ul>
      <p className="font-corpo font-light text-sm text-pergaminho/55 text-center max-w-[44ch]">
        Doze selos, doze familiares. Qual deles é o seu, só as suas escolhas
        dizem.
      </p>
    </section>
  );
}

/* ── o preço, com a condição de lançamento ─────────────────────────────── */

/**
 * O bloco de conversão, igual nas três variantes.
 *
 * ── Sobre a "condição de lançamento" ──────────────────────────────────────
 *
 * O valor riscado é o preço **real** de tabela, que volta a valer quando a
 * condição sair. Isso importa: preço "de/por" com o "de" inventado é infração
 * de publicidade enganosa (CDC art. 37), e é o erro mais comum de página de
 * vendas apressada. Aqui o número riscado é o mesmo que está nos Termos.
 */
export function Precos({ descontoPercentual }: { descontoPercentual: number }) {
  const linhas = [PRODUTOS.revelacao, PRODUTOS.completa].map((p) => ({
    produto: p,
    preco: precoComDesconto(p, descontoPercentual),
  }));

  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-5">
      {descontoPercentual > 0 && (
        <span className="font-corpo text-[0.65rem] tracking-[0.2em] uppercase text-vela border border-vela/40 rounded-full px-4 py-1.5">
          Condição de lançamento
        </span>
      )}

      <div className="w-full grid sm:grid-cols-2 gap-3">
        {linhas.map(({ produto, preco }) => (
          <div
            key={produto.id}
            className="rounded-2xl border border-pergaminho/15 px-5 py-4 flex flex-col gap-1.5"
          >
            <span className="font-display italic text-xl text-pergaminho">
              {produto.nome}
            </span>
            <span className="flex items-baseline gap-2">
              {preco.descontoPercentual > 0 && (
                <span className="font-corpo text-sm text-pergaminho/40 line-through tabular-nums">
                  {`R$ ${precoFormatado(produto)}`}
                </span>
              )}
              <span className="font-corpo text-2xl text-vela tabular-nums">
                {`R$ ${(preco.finalCentavos / 100).toFixed(2).replace('.', ',')}`}
              </span>
            </span>
            <span className="font-corpo font-light text-xs text-pergaminho/55 leading-relaxed">
              {produto.id === 'completa'
                ? 'Leitura longa, os gráficos do seu perfil e link público para sempre.'
                : 'Seu familiar, a leitura, a carta e o PDF. Link público por 7 dias.'}
            </span>
          </div>
        ))}
      </div>

      <p className="font-corpo font-light text-xs text-pergaminho/50 text-center max-w-[46ch] leading-relaxed">
        Você escolhe o plano no fim do ritual, depois de ver quem te encontrou.
        Compra única, sem assinatura. Sete dias para desistir e receber tudo de
        volta, sem precisar explicar.
      </p>
    </section>
  );
}

/* ── porta do mural ────────────────────────────────────────────────────── */

export function PortaDoMural({ texto }: { texto?: string }) {
  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-4 text-center">
      <h2 className="font-display italic text-2xl sm:text-3xl text-pergaminho text-balance">
        {texto ?? 'Ficou em dúvida?'}
      </h2>
      <p className="font-corpo font-light text-sm text-pergaminho/60 max-w-[40ch] leading-relaxed">
        Veja revelações que outras pessoas receberam — inteiras, do jeito que
        chegam. Nada de amostra recortada.
      </p>
      <Link
        href="/mural"
        className="inline-flex items-center gap-2 font-corpo text-sm text-pergaminho px-6 py-3 rounded-full border border-pergaminho/25 hover:border-vela hover:text-vela transition-colors"
      >
        Abrir um familiar misterioso
      </Link>
    </section>
  );
}

/* ── barra do topo ─────────────────────────────────────────────────────── */

export function BarraDoTopo() {
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

/* ── como funciona, versão curta ───────────────────────────────────────── */

export function ComoFunciona() {
  const passos = [
    {
      n: '1',
      titulo: `${TOTAL_DE_ITENS} cenas`,
      texto:
        'Sem resposta certa. Ninguém te pergunta se você é assertiva — te colocam numa sala em que alguém precisa falar primeiro.',
    },
    {
      n: '2',
      titulo: 'Ele te encontra',
      texto:
        'O resultado sai das suas escolhas — e o seu Sol e a sua Lua entram na leitura que ele escreve sobre você.',
    },
    {
      n: '3',
      titulo: 'Fica com você',
      texto:
        'Conta no Bruxário para sempre, mais o PDF e as imagens no seu e-mail.',
    },
  ];

  return (
    <section className="w-full max-w-2xl grid sm:grid-cols-3 gap-4">
      {passos.map((p) => (
        <div key={p.n} className="flex flex-col gap-1.5">
          <span className="font-display italic text-lg text-vela">{p.titulo}</span>
          <span className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed">
            {p.texto}
          </span>
        </div>
      ))}
    </section>
  );
}
