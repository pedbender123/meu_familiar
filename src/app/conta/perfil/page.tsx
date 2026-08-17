import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { produtoDe, linkPublicoExpirou, diasRestantes } from '@/lib/produtos';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { BotaoSair } from '@/components/BotaoSair';

interface Linha {
  id: string;
  familiar: string;
  produto: string;
  expira_em: string | null;
  criado_em: string;
  leitura_json: string | null;
}

/**
 * O perfil: quem é a pessoa aqui dentro, e o que ela pode abrir.
 *
 * Cada revelação vira uma linha com **um botão que faz uma coisa só**: abrir o
 * relatório. O estado do acesso vem escrito na linha em vez de o botão sumir —
 * botão que desaparece deixa a pessoa achando que perdeu o que comprou, e o
 * que ela precisa saber é que o endereço expirou, não o produto.
 */
export default async function Perfil() {
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
      `SELECT id, familiar, produto, expira_em, criado_em, leitura_json
       FROM pedidos WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC`
    )
    .all(sessao.email) as Linha[];

  return (
    <section className="w-full max-w-2xl flex flex-col items-center gap-7 pt-4 sm:pt-8">
      <FolhaPergaminho>
        <p className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          Seu perfil
        </p>
        <p className="font-corpo text-base text-escrita text-center break-all">
          {sessao.email}
        </p>
        <p className="font-corpo font-light text-xs text-escrita-fraca text-center">
          Sem senha para lembrar — o acesso é sempre por link no seu e-mail.
        </p>

        <hr className="w-20 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <h2 className="font-display italic text-xl sm:text-2xl text-escrita text-center">
          {revelacoes.length === 1
            ? 'Sua revelação'
            : `Suas revelações (${revelacoes.length})`}
        </h2>

        {revelacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <p className="font-corpo font-light text-sm text-escrita-corpo text-center max-w-[32ch]">
              Nada guardado ainda.
            </p>
            <Link
              href="/ritual"
              className="bg-vela text-tinta font-corpo font-medium px-7 py-3.5 rounded-full hover:brightness-110 transition"
            >
              Começar o ritual
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4 self-stretch">
            {revelacoes.map((r) => {
              const familiar = FAMILIARES[r.familiar as FamiliarId];
              const produto = produtoDe(r.produto);
              const semLinkPublico = linkPublicoExpirou(r.expira_em);
              const leitura = r.leitura_json ? JSON.parse(r.leitura_json) : null;
              const dias = r.expira_em ? Math.max(0, diasRestantes(r.expira_em)) : null;

              return (
                <li
                  key={r.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-escrita/15 px-4 py-4"
                >
                  <span className="shrink-0 self-center opacity-90">
                    <SigiloFamiliar
                      sigilo={familiar.sigilo}
                      tamanho={56}
                      variante="papel"
                      animado={false}
                    />
                  </span>

                  <span className="flex-1 min-w-0 text-center sm:text-left">
                    <span className="block font-display italic text-lg text-escrita">
                      {familiar.nome}
                      {leitura?.nome_secreto && (
                        <span className="text-ouro-velho"> · {leitura.nome_secreto}</span>
                      )}
                    </span>
                    <span className="block font-corpo text-xs text-escrita-fraca mt-0.5">
                      {produto.nome} ·{' '}
                      {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                      {semLinkPublico
                        ? ' · sem link para compartilhar'
                        : dias !== null
                          ? ` · link aberto por mais ${dias} ${dias === 1 ? 'dia' : 'dias'}`
                          : ' · link permanente'}
                    </span>
                  </span>

                  <Link
                    // A dona sempre consegue abrir — o link só fecha para
                    // estranhos. Mandar ela pro pagamento seria cobrar de novo
                    // pelo que ela já tem.
                    href={`/revelacao/${r.id}`}
                    className="shrink-0 text-center font-corpo font-medium text-sm px-5 py-2.5 rounded-full transition bg-vela text-tinta hover:brightness-110"
                  >
                    Ver meu relatório
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </FolhaPergaminho>

      <BotaoSair />
    </section>
  );
}
