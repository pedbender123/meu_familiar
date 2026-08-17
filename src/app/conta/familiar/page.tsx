import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId, type LuaId } from '@/lib/familiares';
import { CartaFamiliar } from '@/components/CartaFamiliar';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';

/** Mesma anotação manuscrita usada em `/revelacao/[id]`. */
const LEGENDA_LUA: Record<LuaId, string> = {
  nova: 'sob a lua nova, quando nada ainda tem nome',
  crescente: 'sob a lua crescente, com tudo ainda por acontecer',
  cheia: 'sob a lua cheia, quando não há onde se esconder',
  minguante: 'sob a lua minguante, na hora de deixar ir',
};

interface Linha {
  id: string;
  familiar: string;
  lua: string | null;
  leitura_json: string | null;
  criado_em: string;
}

/**
 * O capítulo do familiar — a gravura, não só o texto.
 *
 * A carta (`carta.webp`) é a mesma arte que sai no story: ela já é gerada em
 * toda entrega, mas até aqui só existia em `/revelacao/[id]` e no e-mail. Num
 * grimório, a página do familiar sem a estampa dele é uma ficha; com ela é
 * uma página de livro ilustrado — e é a imagem que faz a pessoa querer
 * mostrar pra alguém.
 */
export default async function FamiliarDaConta() {
  const sessao = await sessaoAtual();

  const revelacoes = db
    .prepare(
      `SELECT id, familiar, lua, leitura_json, criado_em FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC`
    )
    .all(sessao!.email) as Linha[];

  if (revelacoes.length === 0) {
    return (
      <section className="w-full max-w-md flex flex-col items-center gap-6 pt-10 text-center">
        <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-escrita-fraca">
          Capítulo II
        </p>
        <h1 className="font-display italic text-3xl text-escrita text-balance max-w-[22ch]">
          Esta página ainda está em branco.
        </h1>
        <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[32ch] leading-relaxed">
          Nenhum familiar atravessou o véu até você. O ritual é o que abre a
          primeira.
        </p>
        <Link
          href="/ritual"
          className="font-corpo text-sm px-6 py-3 rounded-full border border-ouro-velho/45 text-ouro-profundo hover:bg-ouro-velho/10 transition-colors"
        >
          Fazer o ritual
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-14 pt-2">
      {revelacoes.map((linha, i) => {
        const familiar = FAMILIARES[linha.familiar as FamiliarId];
        const leitura = linha.leitura_json ? JSON.parse(linha.leitura_json) : null;
        if (!familiar) return null;
        const lua = linha.lua ? LEGENDA_LUA[linha.lua as LuaId] : undefined;

        return (
          <article
            key={linha.id}
            className="w-full flex flex-col items-center gap-6 text-center"
          >
            {i === 0 && (
              <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-escrita-fraca">
                Capítulo II · Seu familiar
              </p>
            )}

            <CartaFamiliar
              pedidoId={linha.id}
              alt={`${familiar.nome}, seu familiar`}
              legenda={lua}
            />

            <div className="flex flex-col items-center gap-1.5">
              <h2 className="font-display italic text-3xl text-escrita text-balance leading-tight">
                {familiar.nome}
              </h2>
              {leitura?.nome_secreto && (
                <p className="font-ritual text-2xl text-ouro-profundo leading-none">
                  {leitura.nome_secreto}
                </p>
              )}
            </div>

            <SigiloFamiliar sigilo={familiar.sigilo} tamanho={92} animado={false} />

            {leitura?.sussurro_final && (
              <p className="font-display italic text-lg leading-relaxed text-escrita-corpo max-w-[32ch]">
                &ldquo;{leitura.sussurro_final}&rdquo;
              </p>
            )}

            <Link
              href={`/revelacao/${linha.id}`}
              className="font-corpo text-sm px-6 py-2.5 rounded-full border border-ouro-velho/40 text-ouro-profundo hover:bg-ouro-velho/10 transition-colors"
            >
              Abrir a revelação completa
            </Link>
          </article>
        );
      })}
    </section>
  );
}
