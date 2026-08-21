import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { desde, ehJanela, JANELAS, type Janela } from '@/lib/analitica';
import {
  comparacaoDeFunis,
  jornadaLegivel,
  resumoDeToques,
  vendasPorAtribuicao,
  ROTULOS_DE_EMAIL,
} from '@/lib/toques';
import { FUNIS, ehFunil } from '@/lib/funis';
import { Jornada } from '@/components/painel/Jornada';
import { Bloco, Vazio } from '@/components/painel/GraficosPeriodo';
import { buscarPedido, codigoCurtoDoPedido } from '@/lib/db';
import Database from 'better-sqlite3';
import { BANCO } from '@/lib/caminhos';

export const metadata = { title: 'Rastreio', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * De onde vem tudo — e o que cada coisa vale.
 *
 * ── A pergunta que esta tela responde ─────────────────────────────────────
 *
 * "Uma venda caiu como origem `outro`." Essa frase é o motivo de tudo aqui.
 * `outro` era o balde onde caía o tráfego mal marcado, quem digitou o
 * endereço, quem veio por indicação e quem clicou num vídeo cujo link não
 * carregava peça — quatro coisas com valores completamente diferentes.
 *
 * A tela separa as quatro, e separa também **aquisição de retorno**, que é a
 * confusão mais cara: o clique no e-mail de login é a mesma pessoa voltando,
 * não uma pessoa nova, e contá-lo como canal inventa um canal produtivo que
 * não traz ninguém.
 */
const NOME_DO_TIPO: Record<string, string> = {
  campanha: 'Campanha (anúncio)',
  social: 'Rede social',
  compartilhamento: 'Indicação de cliente',
  remarketing: 'E-mail de remarketing',
  email: 'E-mail transacional',
  direto: 'Direto / sem marcação',
};

const NOME_DA_ATRIBUICAO: Record<string, string> = {
  campanha: 'Anúncio (primeiro toque)',
  social: 'Rede social (primeiro toque)',
  compartilhamento: 'Indicação de cliente',
  remarketing: 'Reconquista por e-mail',
  direto: 'Direto',
  email: 'E-mail',
  legado: 'Antes do rastreio por peça',
};

export default async function Rastreio({
  searchParams,
}: {
  searchParams: Promise<{ janela?: string; q?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const { janela: bruta, q } = await searchParams;
  const janela: Janela = ehJanela(bruta) ? bruta : '30d';
  const corte = desde(janela);

  const porTipo = resumoDeToques(corte);
  const porAtribuicao = vendasPorAtribuicao(corte);
  const totalAquisicoes = porTipo.reduce((s, t) => s + t.aquisicoes, 0);

  const alvo = q?.trim() ? procurarPessoa(q.trim()) : null;
  const funis = comparacaoDeFunis(corte);

  return (
    <main className="flex flex-col gap-6 p-5 sm:p-7">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display italic text-2xl">Rastreio</h1>
          <p className="text-sm opacity-55 mt-0.5">
            De onde as pessoas vieram, e qual chegada leva o crédito.
          </p>
        </div>
        <nav className="flex gap-1">
          {JANELAS.map((j) => (
            <Link
              key={j.id}
              href={`/painel/rastreio?janela=${j.id}`}
              className={[
                'text-xs px-3 py-1.5 rounded-full border transition',
                j.id === janela
                  ? 'border-vela/50 text-vela bg-vela/10'
                  : 'border-pergaminho/15 opacity-60 hover:opacity-100',
              ].join(' ')}
            >
              {j.rotulo}
            </Link>
          ))}
        </nav>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Bloco
          titulo="Chegadas por canal"
          nota="Aquisição é gente nova. Retorno é a mesma pessoa voltando — somar os dois é o erro que inflava o canal e-mail."
        >
          {porTipo.length === 0 ? (
            <Vazio>Nenhuma chegada nesta janela.</Vazio>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] uppercase tracking-[0.14em] opacity-55">
                  <th className="py-1.5 font-normal">Canal</th>
                  <th className="py-1.5 font-normal text-right">Aquisições</th>
                  <th className="py-1.5 font-normal text-right">Retornos</th>
                  <th className="py-1.5 font-normal text-right">Pessoas</th>
                </tr>
              </thead>
              <tbody>
                {porTipo.map((t) => (
                  <tr key={t.tipo} className="border-t border-pergaminho/10">
                    <td className="py-2">{NOME_DO_TIPO[t.tipo] ?? t.tipo}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {t.aquisicoes || '—'}
                      {t.aquisicoes > 0 && totalAquisicoes > 0 && (
                        <span className="block text-[10px] opacity-45">
                          {((t.aquisicoes / totalAquisicoes) * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums opacity-55">
                      {t.retornos || '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums opacity-75">{t.pessoas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloco>

        <Bloco
          titulo="A quem as vendas foram creditadas"
          nota="Primeiro toque vence sempre — só o remarketing sobrescreve, porque ele existe para trazer de volta quem já tinha ido."
        >
          {porAtribuicao.length === 0 ? (
            <Vazio>Nenhum pedido nesta janela.</Vazio>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] uppercase tracking-[0.14em] opacity-55">
                  <th className="py-1.5 font-normal">Crédito</th>
                  <th className="py-1.5 font-normal">Canal</th>
                  <th className="py-1.5 font-normal text-right">Pedidos</th>
                  <th className="py-1.5 font-normal text-right">Vendas</th>
                </tr>
              </thead>
              <tbody>
                {porAtribuicao.map((a, i) => (
                  <tr key={i} className="border-t border-pergaminho/10">
                    <td className="py-2">
                      {NOME_DA_ATRIBUICAO[a.atribuicao] ?? a.atribuicao}
                    </td>
                    <td className="py-2 opacity-70">{a.origem ?? '—'}</td>
                    <td className="py-2 text-right tabular-nums opacity-70">{a.pedidos}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {a.vendas || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloco>
      </div>

      <Bloco
        titulo="Qual funil vende mais"
        nota="Só entram pedidos com funil gravado. Os anteriores ao teste ficam de fora — misturá-los daria a um dos lados o histórico inteiro do site."
        largo
      >
        {funis.length === 0 ? (
          <Vazio>Nenhuma venda por funil ainda nesta janela.</Vazio>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-[0.14em] opacity-55">
                <th className="py-1.5 font-normal">Funil</th>
                <th className="py-1.5 font-normal text-right">Chegaram</th>
                <th className="py-1.5 font-normal text-right">Pedidos</th>
                <th className="py-1.5 font-normal text-right">Vendas</th>
                <th className="py-1.5 font-normal text-right">Receita</th>
                <th className="py-1.5 font-normal text-right">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {funis.map((f) => {
                const meta = ehFunil(f.funil) ? FUNIS[f.funil] : null;
                const conv = f.pessoas > 0 ? (f.vendas / f.pessoas) * 100 : null;
                return (
                  <tr key={f.funil} className="border-t border-pergaminho/10 align-top">
                    <td className="py-2.5 pr-3">
                      <span className="block">{meta?.nome ?? f.funil}</span>
                      {meta && (
                        <>
                          <code className="text-[10px] opacity-45">
                            {meta.caminho}
                          </code>
                          <span className="block text-[11px] opacity-45 leading-snug max-w-[46ch] mt-1">
                            {meta.aposta}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums opacity-75">{f.pessoas || '—'}</td>
                    <td className="py-2.5 text-right tabular-nums opacity-75">{f.pedidos}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{f.vendas || '—'}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {f.receitaCentavos > 0
                        ? `R$ ${(f.receitaCentavos / 100).toFixed(2).replace('.', ',')}`
                        : '—'}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {conv !== null ? `${conv.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="text-[11px] opacity-45 leading-relaxed mt-4">
          Link do teste A/B:{' '}
          <code>bruxario.com.br/?f=ab</code> — sorteia entre os dois e gruda no
          visitante. Para forçar um:{' '}
          {Object.values(FUNIS).map((f) => (
            <code key={f.id} className="mr-2">?f={f.codigo}</code>
          ))}
        </p>
      </Bloco>

      <Bloco
        titulo="A jornada de uma pessoa"
        nota="Busque por e-mail, nome ou id do pedido. Passe o mouse num passo de campanha para abrir o relatório dela."
        largo
      >
        <form method="GET" className="flex flex-wrap gap-2 mb-5">
          <input type="hidden" name="janela" value={janela} />
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="maria@exemplo.com, Marina, ou o id do pedido"
            className="flex-1 min-w-[240px] bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 text-sm focus:border-vela outline-none"
          />
          <button className="text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition">
            Ver a jornada
          </button>
        </form>

        {!q?.trim() ? (
          <Vazio>Digite algo acima para ver por onde a pessoa passou.</Vazio>
        ) : !alvo ? (
          <Vazio>Ninguém encontrado com “{q}”.</Vazio>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-display italic text-lg">{alvo.nome}</span>
                <span className="opacity-45 text-xs">{alvo.email || 'sem e-mail'}</span>
              </div>
              <Campo rotulo="Situação" valor={alvo.status} />
              <Campo
                rotulo="Crédito da venda"
                valor={NOME_DA_ATRIBUICAO[alvo.atribuicao ?? 'legado'] ?? alvo.atribuicao ?? '—'}
              />
              <Campo rotulo="Canal gravado" valor={alvo.origem ?? '—'} />
              {alvo.campanhaNome && (
                <Campo
                  rotulo="Campanha"
                  valor={alvo.campanhaNome + (alvo.pecaNome ? ` — ${alvo.pecaNome}` : '')}
                  href={`/painel/campanhas/${alvo.campanha_id}`}
                />
              )}
              {alvo.indicadorNome && (
                <Campo rotulo="Indicado por" valor={alvo.indicadorNome} />
              )}
              <Campo
                rotulo="Link de indicação dela"
                valor={`/?s=${codigoCurtoDoPedido(alvo.id)}`}
              />
            </div>

            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.14em] opacity-55 mb-3">
                Por onde passou
              </p>
              <Jornada passos={alvo.visitante ? jornadaLegivel(alvo.visitante) : []} />
            </div>
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Os marcadores de e-mail"
        nota="Cada e-mail carrega o seu. É isso que separa quem voltou de quem chegou."
        largo
      >
        <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 text-sm">
          {Object.entries(ROTULOS_DE_EMAIL).map(([marca, { rotulo, conta }]) => (
            <div key={marca} className="flex items-baseline justify-between gap-3 py-1 border-b border-pergaminho/8">
              <span>
                <code className="text-xs opacity-60 mr-2">?e={marca}</code>
                {rotulo}
              </span>
              <span
                className={conta ? 'text-xs text-vela' : 'text-xs opacity-40'}
              >
                {conta ? 'conta como aquisição' : 'retorno'}
              </span>
            </div>
          ))}
        </div>
      </Bloco>
    </main>
  );
}

function Campo({
  rotulo,
  valor,
  href,
}: {
  rotulo: string;
  valor: string;
  href?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[0.65rem] uppercase tracking-[0.14em] opacity-45 w-36 shrink-0">
        {rotulo}
      </span>
      {href ? (
        <Link href={href} className="underline decoration-dotted underline-offset-4 hover:text-vela">
          {valor}
        </Link>
      ) : (
        <span className="opacity-85">{valor}</span>
      )}
    </div>
  );
}

/**
 * Acha alguém por e-mail, nome ou id — e já traz os nomes de campanha e peça.
 *
 * Uma consulta só com `LEFT JOIN` em vez de quatro idas ao banco: esta tela é
 * de leitura e roda a cada busca, e resolver nome de campanha numa segunda
 * consulta por resultado é o tipo de coisa que fica lenta sem ninguém notar.
 */
function procurarPessoa(termo: string) {
  const db = new Database(BANCO);
  const alvo = `%${termo.toLowerCase()}%`;
  return db
    .prepare(
      `SELECT p.*,
              c.nome AS campanhaNome,
              pc.nome AS pecaNome,
              ind.nome AS indicadorNome
         FROM pedidos p
         LEFT JOIN campanhas c  ON c.id  = p.campanha_id
         LEFT JOIN pecas     pc ON pc.id = p.peca_id
         LEFT JOIN pedidos   ind ON ind.id = p.indicado_por
        WHERE lower(p.email) LIKE ?
           OR lower(p.nome)  LIKE ?
           OR p.id = ?
        ORDER BY p.criado_em DESC
        LIMIT 1`
    )
    .get(alvo, alvo, termo) as
    | (ReturnType<typeof buscarPedido> & {
        campanhaNome: string | null;
        pecaNome: string | null;
        indicadorNome: string | null;
      })
    | undefined;
}
