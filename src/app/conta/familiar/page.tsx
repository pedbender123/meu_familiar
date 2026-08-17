import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId, type LuaId } from '@/lib/familiares';
import { CartaFamiliar } from '@/components/CartaFamiliar';

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
 * O módulo `perfil` (familiar + teste) dentro da casca da plataforma.
 *
 * A gravura (`carta.webp`) é a mesma arte que sai no story: já é gerada em
 * toda entrega, mas até aqui só existia em `/revelacao/[id]` e no e-mail. É
 * ela que faz esta página valer a visita — e é a imagem que a pessoa quer
 * mostrar pra alguém.
 *
 * O relatório completo continua morando em `/revelacao/[id]`; esta tela é a
 * porta, não uma segunda cópia dele.
 */
export default async function FamiliarDaConta() {
  const sessao = await sessaoAtual();

  /**
   * O layout já barra quem não tem sessão, mas em Next 16 layout e página
   * renderizam **em paralelo** — o `redirect()` de lá acontece, e mesmo assim
   * o corpo daqui executa uma vez com `sessao` nula. Sem esta saída, todo
   * acesso deslogado lança `Cannot read properties of null` no servidor:
   * a pessoa é redirecionada do mesmo jeito, mas o log enche de erro e um
   * problema de verdade passa despercebido no meio.
   */
  if (!sessao) return null;

  const revelacoes = db
    .prepare(
      `SELECT id, familiar, lua, leitura_json, criado_em FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC`
    )
    .all(sessao.email) as Linha[];

  if (revelacoes.length === 0) {
    return (
      <section className="w-full max-w-xl flex flex-col items-center gap-7 pt-8 text-center">
        <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[24ch]">
          Nenhum familiar atravessou ainda.
        </h1>
        <Link
          href="/ritual"
          className="font-corpo text-sm px-6 py-3 rounded-full border border-vela/50 text-vela hover:bg-vela/10 transition-colors"
        >
          Fazer o ritual
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl flex flex-col items-center gap-14 pt-4">
      {revelacoes.map((linha) => {
        const familiar = FAMILIARES[linha.familiar as FamiliarId];
        const leitura = linha.leitura_json ? JSON.parse(linha.leitura_json) : null;
        if (!familiar) return null;
        const lua = linha.lua ? LEGENDA_LUA[linha.lua as LuaId] : undefined;

        return (
          <article
            key={linha.id}
            className="w-full flex flex-col items-center gap-6 text-center"
          >
            <CartaFamiliar
              pedidoId={linha.id}
              alt={`${familiar.nome}, seu familiar`}
              legenda={lua}
            />

            <div className="flex flex-col items-center gap-1">
              <h2 className="font-display italic text-3xl text-pergaminho text-balance leading-tight">
                {familiar.nome}
              </h2>
              {leitura?.nome_secreto && (
                <p className="font-ritual text-2xl text-vela leading-none">
                  {leitura.nome_secreto}
                </p>
              )}
            </div>

            {leitura?.sussurro_final && (
              <p className="font-display italic text-lg leading-relaxed text-pergaminho/70 max-w-[32ch]">
                &ldquo;{leitura.sussurro_final}&rdquo;
              </p>
            )}

            <Link
              href={`/revelacao/${linha.id}`}
              className="font-corpo text-sm px-6 py-2.5 rounded-full border border-vela/45 text-vela hover:bg-vela/10 transition-colors"
            >
              Abrir a revelação completa
            </Link>
          </article>
        );
      })}
    </section>
  );
}
