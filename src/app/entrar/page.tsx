import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { FormularioDeAcesso } from '@/components/FormularioDeAcesso';
import Link from 'next/link';

export const metadata = { title: 'Entrar no Bruxário' };

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-14">
        <FolhaPergaminho>
          <h1 className="font-display italic text-2xl sm:text-3xl text-escrita text-center text-balance">
            Entrar no seu Bruxário
          </h1>
          <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[38ch] leading-relaxed">
            Sem senha. Você diz o e-mail, a gente manda um link, e ele te deixa
            entrar uma vez só.
          </p>

          {estado === 'invalido' && (
            <p className="font-corpo text-sm text-center text-red-700 bg-red-900/5 border border-red-800/20 rounded-xl px-4 py-3 max-w-[40ch]">
              Esse link não vale mais — ou já foi usado, ou passou dos 20
              minutos. Peça outro abaixo.
            </p>
          )}

          <FormularioDeAcesso />

          {/*
            A conta não se cria sozinha: ela nasce do ritual. Por isso aqui não
            há "cadastrar" — há o caminho que de fato leva a ter uma conta.
            Prometer um cadastro que não existe mandaria a pessoa procurar um
            formulário que ela não vai achar.
          */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="font-corpo font-light text-xs text-escrita-fraca">
              Ainda não tem conta?
            </p>
            <Link
              href="/ritual"
              className="font-corpo text-sm text-escrita underline underline-offset-4 decoration-ouro-velho/50 hover:decoration-ouro-velho transition"
            >
              Fazer o ritual e criar a minha
            </Link>
            <p className="font-corpo font-light text-xs text-escrita-fraca text-center max-w-[34ch] leading-relaxed">
              A conta nasce junto com a sua revelação — e ela fica guardada lá
              para sempre.
            </p>
          </div>
        </FolhaPergaminho>
      </main>
    </>
  );
}
