import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { RodapeLegal } from '@/components/RodapeLegal';
import { FormularioDeContato } from '@/components/FormularioDeContato';

export const metadata = { title: 'Falar com o Bruxário' };

export default async function Contato({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string; assunto?: string }>;
}) {
  const { pedido, assunto } = await searchParams;

  return (
    <>
      <PoeiraNaLuz />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-8 px-5 py-12">
        <FolhaPergaminho>
          <h1 className="font-display italic text-2xl sm:text-3xl text-escrita text-center">
            Falar com o Bruxário
          </h1>
          <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[42ch] leading-relaxed">
            Do outro lado tem uma pessoa, não um robô — e é uma operação
            pequena. Pode não ser imediato, mas não fica sem resposta.
          </p>

          <FormularioDeContato
            pedidoInicial={pedido ?? ''}
            assuntoInicial={assunto ?? 'duvida'}
          />
        </FolhaPergaminho>

        <RodapeLegal />
      </main>
    </>
  );
}
