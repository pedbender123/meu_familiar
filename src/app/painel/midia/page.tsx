import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { listarCampanhas, funilDeMidia, type LinhaDeMidia } from '@/lib/campanhas';
import { Bloco, Vazio, brl, OURO, VERDE } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Mídia', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A leitura de mídia nos três degraus do gerenciador: campanha, conjunto e
 * criativo.
 *
 * ── A pergunta do meio ────────────────────────────────────────────────────
 *
 * A dash por peça já dizia qual vídeo vende. Faltava **qual público
 * respondeu** — e é no conjunto que público e orçamento se decidem. Um
 * criativo excelente num conjunto errado parece um criativo ruim, e sem este
 * degrau a conclusão sai errada com números certos.
 *
 * ── Por que agora ─────────────────────────────────────────────────────────
 *
 * Porque o mesmo vídeo passou a rodar em vários anúncios. Cada anúncio tem um
 * `{{ad.id}}` diferente, então vira uma linha diferente aqui — e um criativo
 * que vende bem aparece partido em cinco linhas medianas. Agrupar por conjunto
 * é o que devolve a leitura.
 *
 * ── O que esta tela não mede ──────────────────────────────────────────────
 *
 * Custo. A Meta não manda gasto no link, e o investimento do painel é digitado
 * por campanha, à mão. Tudo aqui é do lado da receita; CPA se faz cruzando com
 * o gerenciador. Inventar um rateio de gasto por criativo daria um número com
 * cara de verdade e sem lastro nenhum.
 */

function Linha({ l }: { l: LinhaDeMidia }) {
  const conversao = l.pessoas > 0 ? (l.vendas / l.pessoas) * 100 : 0;

  const recuo = l.nivel === 'campanha' ? 0 : l.nivel === 'conjunto' ? 1 : 2;
  const peso = l.nivel === 'campanha' ? 'font-medium' : 'font-light';
  const cor =
    l.nivel === 'campanha'
      ? 'text-pergaminho'
      : l.nivel === 'conjunto'
        ? 'text-pergaminho/80'
        : 'text-pergaminho/60';

  return (
    <tr className="border-t border-pergaminho/8 hover:bg-pergaminho/[0.03]">
      <td className={`px-2.5 py-1.5 ${peso} ${cor}`}>
        <span style={{ paddingLeft: `${recuo * 1.1}rem` }} className="inline-flex items-baseline gap-2">
          {l.nivel === 'conjunto' && <span className="opacity-30">└</span>}
          {l.nivel === 'criativo' && <span className="opacity-20">·</span>}
          <span className="truncate max-w-[22rem]">{l.nome}</span>
        </span>
      </td>
      <td className="px-2.5 py-1.5 font-mono text-[10px] text-pergaminho/25 whitespace-nowrap">
        {l.idDaMeta ?? '—'}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">{l.pessoas}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums opacity-70">{l.entraram}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums opacity-70">{l.viramOferta}</td>
      <td className="px-2.5 py-1.5 text-right tabular-nums font-medium"
        style={{ color: l.vendas > 0 ? OURO : undefined }}>
        {l.vendas}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums"
        style={{ color: l.receitaCentavos > 0 ? VERDE : undefined }}>
        {l.receitaCentavos > 0 ? brl(l.receitaCentavos) : '—'}
      </td>
      <td className="px-2.5 py-1.5 text-right tabular-nums">
        {l.pessoas > 0 ? `${conversao.toFixed(1)}%` : '—'}
      </td>
    </tr>
  );
}

export default async function Midia() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const campanhas = listarCampanhas();
  const comMovimento = campanhas
    .map((c) => ({ campanha: c, linhas: funilDeMidia(c.id) }))
    .filter((x) => x.linhas.length > 0 && x.linhas[0].pessoas > 0)
    .sort((a, b) => b.linhas[0].vendas - a.linhas[0].vendas);

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <header className="flex flex-col gap-1">
        <h1 className="font-titulo text-2xl text-pergaminho/90">Mídia</h1>
        <p className="font-corpo font-light text-[12px] text-pergaminho/45 max-w-[78ch]">
          Os três degraus do gerenciador: campanha, conjunto e criativo — montados
          com o que a Meta manda no link do anúncio. O ID ao lado de cada linha é
          o mesmo que aparece lá, para achar sem procurar pelo nome.
        </p>
      </header>

      {comMovimento.length === 0 ? (
        <Bloco titulo="Nada com movimento ainda">
          <Vazio />
          <p className="font-corpo font-light text-[11px] text-pergaminho/40 leading-relaxed max-w-[70ch]">
            Esta tela se enche sozinha assim que o primeiro clique de um anúncio
            com as macros de UTM chegar. O link pronto está no topo de{' '}
            <Link href="/painel/campanhas" className="text-vela underline underline-offset-4">
              Campanhas
            </Link>
            .
          </p>
        </Bloco>
      ) : (
        comMovimento.map(({ campanha, linhas }) => (
          <Bloco
            key={campanha.id}
            titulo={campanha.nome}
            nota="Conjunto é onde público e orçamento se decidem. O mesmo vídeo em anúncios diferentes aparece em linhas diferentes — é assim que a Meta os identifica."
            largo
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse font-corpo text-[11px] min-w-[46rem]">
                <thead>
                  <tr className="text-pergaminho/40">
                    {['', 'id na Meta', 'pessoas', 'entraram', 'viram oferta', 'vendas', 'receita', 'conversão'].map(
                      (c, i) => (
                        <th key={c || i} scope="col"
                          className={`font-medium px-2.5 py-2 whitespace-nowrap ${i < 2 ? 'text-left' : 'text-right'}`}>
                          {c}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="text-pergaminho/75">
                  {linhas.map((l) => (
                    <Linha key={`${l.nivel}-${l.id}`} l={l} />
                  ))}
                </tbody>
              </table>
            </div>
          </Bloco>
        ))
      )}

      <p className="font-corpo font-light text-[11px] text-pergaminho/30 leading-snug max-w-[80ch]">
        Não há custo aqui: a Meta não manda gasto no link, e o investimento do
        painel é digitado por campanha, à mão. Tudo nesta tela é do lado da
        receita — para CPA por criativo, cruze com o gerenciador.
      </p>
    </div>
  );
}
