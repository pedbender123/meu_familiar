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
    <section className="w-full max-w-lg flex flex-col items-center gap-7 pt-6 sm:pt-10 text-center">
      <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-escrita-fraca">
        Capítulo I · Abertura
      </p>

      {familiar ? (
        <>
          <SigiloFamiliar sigilo={familiar.sigilo} tamanho={140} />

          <div className="flex flex-col gap-1.5">
            <h1 className="font-display italic text-3xl sm:text-4xl text-escrita text-balance leading-tight">
              {familiar.nome}
            </h1>
            {leitura?.nome_secreto && (
              <p className="font-ritual text-3xl text-ouro-profundo leading-none">
                {leitura.nome_secreto}
              </p>
            )}
            <p className="font-corpo font-light text-sm text-escrita-fraca pt-1">
              está com você
            </p>
          </div>

          <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/30 to-transparent" />

          <p className="font-display italic text-lg leading-relaxed text-escrita-corpo max-w-[32ch]">
            &ldquo;{leitura?.sussurro_final ?? 'Eu fico por aqui. Volte quando precisar.'}&rdquo;
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display italic text-3xl text-escrita text-balance max-w-[22ch] leading-tight">
            Seu Bruxário está aberto, mas ainda vazio.
          </h1>
          <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[32ch] leading-relaxed">
            Nenhuma página foi escrita ainda. O ritual escreve a primeira.
          </p>
          <Link
            href="/ritual"
            className="font-corpo text-sm px-7 py-3 rounded-full border border-ouro-velho/45 text-ouro-profundo hover:bg-ouro-velho/10 transition-colors"
          >
            Começar o ritual
          </Link>
        </>
      )}
    </section>
  );
}
