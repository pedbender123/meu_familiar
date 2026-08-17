import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';

/**
 * O início do Bruxário da pessoa.
 *
 * É uma página deliberadamente **quieta**: o sigilo do familiar dela, uma
 * saudação, e nada mais. Encher de card e número transformaria o grimório num
 * painel de controle — e o SPEC 0.5.1 é explícito de que a sensação de
 * plataforma vem de "seu familiar está no seu Bruxário", não de widget.
 *
 * Quando houver tiragem diária, é aqui que ela entra: é a única peça que dá
 * motivo para voltar amanhã.
 */
export default async function InicioDaConta() {
  const sessao = await sessaoAtual();

  const ultima = db
    .prepare(
      `SELECT familiar, leitura_json FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(sessao!.email) as { familiar: string; leitura_json: string | null } | undefined;

  const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
  const leitura = ultima?.leitura_json ? JSON.parse(ultima.leitura_json) : null;

  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-7 pt-8 sm:pt-16 text-center">
      {familiar ? (
        <>
          <SigiloFamiliar sigilo={familiar.sigilo} tamanho={150} variante="quarto" />

          <div className="flex flex-col gap-2">
            <h1 className="font-display italic text-3xl sm:text-4xl text-pergaminho text-balance">
              {familiar.nome}
              {leitura?.nome_secreto && (
                <span className="text-vela"> · {leitura.nome_secreto}</span>
              )}
            </h1>
            <p className="font-corpo font-light text-sm text-pergaminho/55">
              está com você
            </p>
          </div>

          <p className="font-display italic text-lg leading-relaxed text-pergaminho/70 max-w-[34ch]">
            &ldquo;{leitura?.sussurro_final ?? 'Eu fico por aqui. Volte quando precisar.'}&rdquo;
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[24ch]">
            Seu Bruxário está aberto, mas ainda vazio.
          </h1>
          <Link
            href="/ritual"
            className="bg-vela text-tinta font-corpo font-medium px-7 py-3.5 rounded-full hover:brightness-110 transition"
          >
            Começar o ritual
          </Link>
        </>
      )}
    </section>
  );
}
