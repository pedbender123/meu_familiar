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
  status: string;
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
 * A revelação inteira abre em `/conta/familiar/[id]`, aqui dentro. Esta tela é
 * a estante: quem fez mais de um ritual tem mais de um familiar, e é aqui que
 * eles ficam lado a lado.
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

  /**
   * Entregues **e** os que ficaram no meio do caminho.
   *
   * A consulta só trazia `entregue`, e quem fez o ritual sem comprar via a
   * plataforma vazia — nada do que ela acabou de responder. É justamente essa
   * pessoa que o e-mail de acesso traz até aqui.
   *
   * Ela vê a APARÊNCIA do familiar e o nome; a leitura continua trancada. A
   * arte é uma das 48 prontas em disco, então mostrar não custa nada — e o
   * texto, que custaria uma chamada de IA, nunca chegou a ser gerado.
   *
   * `ritual_completo = 1` porque quem parou na terceira cena não tem familiar
   * nenhum para ver: o resultado só existe depois das 26.
   */
  const revelacoes = db
    .prepare(
      `SELECT id, familiar, lua, leitura_json, status, criado_em FROM pedidos
       WHERE lower(email) = ?
         AND (status = 'entregue' OR (status = 'aguardando_pagamento' AND ritual_completo = 1))
       ORDER BY (status = 'entregue') DESC, criado_em DESC`
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

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {linha.status === 'entregue' ? (
                /*
                  Abre DENTRO da plataforma, não mais em `/revelacao/[id]`.

                  O link público continua existindo e continua sendo o que
                  circula — mas mandar a dona para fora do app para ler o que
                  ela comprou é devolvê-la à página solta de onde ela veio, com
                  o menu do produto inteiro do lado de lá da porta.

                  O PDF saiu daqui: ele agora mora na revelação, e só depois de
                  sete dias. Ver `nucleo/carencia.ts`.
                */
                <Link
                  href={`/conta/familiar/${linha.id}`}
                  className="font-corpo text-sm px-6 py-2.5 rounded-full border border-vela/45 text-vela hover:bg-vela/10 transition-colors"
                >
                  Abrir a revelação
                </Link>
              ) : (
                <>
                  {/*
                    Quem não comprou.
                    O lugar é o mesmo, e os dois botões trocam de função: abrir
                    vira comprar, e baixar entrega só a imagem. A leitura — por
                    que ele te escolheu, o Sol e a Lua — é o que continua do
                    outro lado, e é o que a Revelação vende.
                  */}
                  <Link
                    href={`/pagamento/${linha.id}`}
                    className="font-corpo text-sm px-6 py-2.5 rounded-full bg-vela text-tinta hover:brightness-110 transition"
                  >
                    Comprar a revelação
                  </Link>

                  <a
                    href={`/api/storage/${linha.id}/familiar.png`}
                    download={`bruxario-${familiar.nome.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="font-corpo text-sm px-6 py-2.5 rounded-full border border-pergaminho/20 text-pergaminho/65 hover:border-pergaminho/45 hover:text-pergaminho transition-colors"
                  >
                    Baixar a imagem
                  </a>
                </>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
