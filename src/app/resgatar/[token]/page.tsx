import { notFound } from 'next/navigation';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { FormularioDeResgate } from '@/components/FormularioDeResgate';
import { BONUS_DE_CONSULTAS, marcacaoPorToken } from '@/lib/marcacoes';

export const metadata = {
  title: 'Resgatar recompensa — Bruxário',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * A página do link de resgate.
 *
 * Aberta por quem marcou o Bruxário num story sem ter registrado o @. O link
 * já sabe qual perfil é — a pessoa só confirma em qual e-mail o bônus deve
 * cair, porque é a conta dela que vai guardar as consultas.
 */
export default async function Resgatar({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const marcacao = marcacaoPorToken(token);

  if (!marcacao || marcacao.recompensado) notFound();

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center justify-center px-5 py-16">
        <FolhaPergaminho>
          <div className="flex flex-col items-center gap-5 self-stretch text-center">
            <span className="font-corpo text-[0.65rem] tracking-[0.2em] uppercase text-escrita-fraca">
              Obrigado por marcar
            </span>

            <h1 className="font-display italic text-2xl sm:text-3xl text-escrita text-balance">
              {`@${marcacao.arroba}, suas recompensas estão aqui`}
            </h1>

            <p className="font-corpo font-light text-sm text-escrita-corpo leading-relaxed max-w-[42ch]">
              {`Vimos o seu story. Diga em qual e-mail está a sua conta do Bruxário e as ${BONUS_DE_CONSULTAS} consultas ao Oráculo entram nela — junto com o acesso antecipado quando ele abrir.`}
            </p>

            <FormularioDeResgate token={token} />

            <p className="font-corpo text-xs text-escrita-fraca leading-relaxed max-w-[40ch]">
              O Oráculo ainda não abriu e não prometemos data. As consultas
              ficam guardadas na sua conta até lá.
            </p>
          </div>
        </FolhaPergaminho>
      </main>
    </>
  );
}
