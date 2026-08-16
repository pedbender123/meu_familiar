import Link from 'next/link';
import { itensDoMural, type ItemDoMural } from '@/lib/db';
import { FAMILIARES, type FamiliarId, type LuaId } from '@/lib/familiares';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { RodapeLegal } from '@/components/RodapeLegal';
import { linkPublicoExpirou, diasRestantes } from '@/lib/produtos';

export const metadata = {
  title: 'O mural do Bruxário',
  description: 'Revelações que outras pessoas receberam. Leia uma inteira antes de decidir.',
  openGraph: {
    title: 'Quem já foi encontrado',
    description: 'Revelações reais, inteiras. Leia antes de decidir.',
    images: [{ url: '/og/mural.png', width: 1200, height: 630 }],
  },
};

/** Sorteia a ordem a cada visita: o mural nunca parece o mesmo duas vezes. */
export const dynamic = 'force-dynamic';

const LUA: Record<LuaId, string> = {
  nova: 'lua nova',
  crescente: 'lua crescente',
  cheia: 'lua cheia',
  minguante: 'lua minguante',
};

/**
 * O mural: revelações de outras pessoas, para quem ainda está em dúvida.
 *
 * ── Como parecer cheio com dezenas, sem mentir ────────────────────────────
 *
 * Três escolhas honestas fazem o trabalho que um número inflado faria de
 * forma desonesta:
 *
 * 1. **Colunas de altura livre (masonry).** Cartões de tamanhos diferentes
 *    encaixados leem como muito mais denso que uma grade regular com o mesmo
 *    número de itens.
 * 2. **Ordem sorteada a cada visita.** Voltar e ver outra coisa dá a sensação
 *    de acervo grande — e é verdade que a ordem é arbitrária, então nada aqui
 *    engana.
 * 3. **Nenhum contador.** Escrever "1.284 revelações" quando são 30 é mentira
 *    fácil de checar e cara de perder. O mural mostra; não afirma quantidade.
 *
 * Só entram revelações cujo link **ainda abre** — cartão bonito que leva a
 * "este link não abre mais" é pior que cartão nenhum.
 */
export default async function Mural() {
  const itens = embaralhar(itensDoMural(60));

  // O layout usa `columns` do CSS, que dá masonry de verdade (altura livre por
  // cartão) com UMA passada de DOM. A primeira versão renderizava a lista duas
  // vezes — uma para celular, outra em três colunas — e escondia metade por
  // CSS: dobrava o HTML e fazia leitor de tela ler tudo duplicado.

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-8 px-4 sm:px-6 py-12">
        <header className="flex flex-col items-center gap-3 text-center max-w-xl">
          <span className="font-corpo text-[0.7rem] tracking-[0.28em] uppercase text-violeta">
            O mural
          </span>
          <h1 className="font-display italic text-3xl sm:text-4xl text-pergaminho text-balance">
            Quem já foi encontrado
          </h1>
          <p className="font-corpo font-light text-sm text-pergaminho/60 max-w-[44ch] leading-relaxed">
            Revelações de outras pessoas. Abra qualquer uma e leia inteira —
            é exatamente o que você recebe.
          </p>
        </header>

        {itens.length === 0 ? (
          <p className="font-display italic text-xl text-pergaminho/60 py-12">
            O mural ainda está vazio.
          </p>
        ) : (
          <div className="w-full max-w-6xl columns-1 sm:columns-2 lg:columns-3 gap-4">
            {itens.map((item) => (
              <div key={item.id} className="break-inside-avoid mb-4">
                <Cartao item={item} />
              </div>
            ))}
          </div>
        )}

        <Link
          href="/ritual"
          className="mt-4 inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-8 py-4 rounded-full hover:brightness-110 transition"
        >
          Descobrir o meu
        </Link>

        <RodapeLegal />
      </main>
    </>
  );
}

function Cartao({ item }: { item: ItemDoMural }) {
  const familiar = FAMILIARES[item.familiar as FamiliarId];
  const leitura = item.leitura_json ? JSON.parse(item.leitura_json) : null;
  if (!familiar || !leitura) return null;

  const dias = item.expira_em ? diasRestantes(item.expira_em) : null;
  const vaiFechar =
    dias !== null && dias > 0 && !linkPublicoExpirou(item.expira_em);

  // Um trecho da leitura, não a leitura toda: o cartão convida, não entrega.
  const trecho: string = leitura.leitura?.[0] ?? leitura.saudacao ?? '';
  const recorte =
    trecho.length > 190 ? `${trecho.slice(0, 190).trimEnd()}…` : trecho;

  return (
    <Link
      href={`/revelacao/${item.id}`}
      className="group block rounded-2xl border border-pergaminho/12 hover:border-vela/45 bg-pergaminho/[0.02] hover:bg-pergaminho/[0.05] transition-colors px-5 py-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <span className="shrink-0 opacity-75 group-hover:opacity-100 transition-opacity">
          <SigiloFamiliar
            sigilo={familiar.sigilo}
            tamanho={44}
            variante="quarto"
            animado={false}
          />
        </span>
        <span className="min-w-0">
          <span className="block font-display italic text-lg leading-tight text-pergaminho">
            {familiar.nome}
            {leitura.nome_secreto && (
              <span className="text-vela"> · {leitura.nome_secreto}</span>
            )}
          </span>
          <span className="block font-corpo text-[0.7rem] text-pergaminho/45 mt-0.5">
            {primeiroNome(item.nome)} · sob {LUA[item.lua as LuaId] ?? 'a lua'}
          </span>
        </span>
      </div>

      <p className="font-corpo font-light text-sm leading-relaxed text-pergaminho/70">
        {recorte}
      </p>

      {item.comentario && (
        <p className="font-display italic text-sm leading-snug text-vela/85 border-l-2 border-vela/35 pl-3">
          &ldquo;{item.comentario}&rdquo;
        </p>
      )}

      {vaiFechar && (
        <span className="font-corpo text-[0.68rem] text-pergaminho/40">
          {`este link fecha em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
        </span>
      )}
    </Link>
  );
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
