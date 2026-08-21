import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { consolidado, listarDespesas } from '@/lib/financeiro';
import { listarCampanhas } from '@/lib/campanhas';
import { deUtcParaLocal, ehPreset, resolverPeriodo } from '@/lib/periodo';
import { FiltroDePeriodo } from '@/components/painel/FiltroDePeriodo';
import { Despesas } from '@/components/painel/Despesas';
import {
  Bloco,
  Cartao,
  BarrasRotuladas,
  brl,
  OURO,
  VERDE,
  VERMELHO,
} from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Financeiro', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * O fechamento do caixa.
 *
 * ── O que é medido e o que é estimado ─────────────────────────────────────
 *
 * **Medido:** o bruto cobrado e a taxa do Mercado Pago — os dois vêm da
 * resposta do gateway, venda a venda, e batem com o extrato.
 *
 * **Estimado:** o custo de IA. A OpenAI cobra por token e não devolve preço;
 * convertemos pela tabela pública com câmbio fixo (`custos.ts`). Erra
 * centavos, e a tela diz isso em vez de fingir precisão.
 *
 * **Lançado por você:** as despesas. Nada de anúncio, VPS ou domínio entra
 * sozinho — o sistema não tem como saber.
 */
export default async function Financeiro({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; de?: string; ate?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const params = await searchParams;
  const usouFiltro = !!params.p || !!params.de;
  const periodo = resolverPeriodo({ ...params, p: params.p ?? 'tudo' });

  const c = usouFiltro ? consolidado(periodo.de, periodo.ate) : consolidado();
  const despesas = usouFiltro
    ? listarDespesas(periodo.de, periodo.ate)
    : listarDespesas();
  const campanhas = listarCampanhas().map((x) => ({ id: x.id, nome: x.nome }));

  const margem =
    c.brutoCentavos > 0 ? (c.lucroCentavos / c.brutoCentavos) * 100 : 0;

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-corpo font-light text-xs text-pergaminho/45 max-w-[62ch] leading-relaxed">
          Bruto e taxa do Mercado Pago vêm da resposta do gateway, venda a
          venda. O custo de IA é estimado por tokens. As despesas são as que
          você lançar — taxa e IA <strong className="font-medium">não</strong>{' '}
          devem ser lançadas de novo aqui, senão contam duas vezes.
        </p>
        <Suspense fallback={null}>
          <FiltroDePeriodo
            base="/painel/financeiro"
            presetAtivo={ehPreset(params.p) ? params.p : 'tudo'}
            deAtual={deUtcParaLocal(periodo.de)}
            ateAtual={deUtcParaLocal(periodo.ate)}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Cartao rotulo="Receita bruta" valor={brl(c.brutoCentavos)}
          nota={`${c.vendas} venda${c.vendas === 1 ? '' : 's'}`} cor={OURO} />
        <Cartao rotulo="Taxa do MP" valor={brl(c.taxaCentavos)}
          nota="medido no gateway" cor={VERMELHO} />
        <Cartao rotulo="Custo de IA" valor={brl(c.custoIaCentavos)}
          nota="estimado" cor={VERMELHO} />
        <Cartao rotulo="Despesas" valor={brl(c.despesasCentavos)}
          nota="lançadas por você" cor={VERMELHO} />
        <Cartao rotulo="Lucro" valor={brl(c.lucroCentavos)}
          nota={c.brutoCentavos > 0 ? `margem ${margem.toFixed(0)}%` : undefined}
          cor={c.lucroCentavos > 0 ? VERDE : c.lucroCentavos < 0 ? VERMELHO : undefined} />
        <Cartao rotulo="Ticket médio" valor={brl(c.ticketMedioCentavos)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Bloco titulo="Mês a mês"
          nota="A venda entra no mês em que foi paga; a despesa, no mês em que ocorreu.">
          {c.porMes.length === 0 ? (
            <p className="font-corpo text-xs text-pergaminho/30 py-4 text-center">
              Nada ainda.
            </p>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border"
              style={{ borderColor: 'var(--admin-borda)' }}>
              <table className="w-full border-collapse font-corpo text-[11px]">
                <thead>
                  <tr className="text-pergaminho/40">
                    {['mês', 'vendas', 'bruto', 'taxa', 'IA', 'despesas', 'lucro'].map((h, i) => (
                      <th key={h} scope="col"
                        className={`font-medium px-2.5 py-2 ${i === 0 ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-pergaminho/75">
                  {c.porMes.map((m) => (
                    <tr key={m.mes} className="border-t" style={{ borderColor: 'var(--admin-borda)' }}>
                      <td className="px-2.5 py-1.5 tabular-nums">{m.mes}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{m.vendas}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{brl(m.brutoCentavos)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-pergaminho/50">
                        {brl(m.taxaCentavos)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-pergaminho/50">
                        {brl(m.custoIaCentavos)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-pergaminho/50">
                        {brl(m.despesasCentavos)}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums"
                        style={{ color: m.lucroCentavos > 0 ? VERDE : m.lucroCentavos < 0 ? VERMELHO : undefined }}>
                        {brl(m.lucroCentavos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloco>

        <Bloco titulo="Para onde vai o dinheiro">
          <BarrasRotuladas
            linhas={[
              { rotulo: 'taxa do MP', valor: Math.round(c.taxaCentavos / 100) },
              { rotulo: 'IA', valor: Math.round(c.custoIaCentavos / 100) },
              ...c.porCategoria.map((x) => ({
                rotulo: x.categoria,
                valor: Math.round(x.centavos / 100),
              })),
            ].filter((l) => l.valor > 0)}
            sufixo=" R$"
          />
        </Bloco>
      </div>

      <Bloco titulo="Gastos lançados"
        nota="Anúncio, VPS, domínio, arte — o que o sistema não tem como saber sozinho.">
        <Despesas despesas={despesas} campanhas={campanhas} />
      </Bloco>
    </div>
  );
}
