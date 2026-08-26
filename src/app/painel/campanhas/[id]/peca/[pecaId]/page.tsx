import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarCampanha, funilDaPeca } from '@/lib/campanhas';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { Bloco, brl, OURO } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Funil do vídeo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * O funil de UM vídeo, escancarado.
 *
 * A tabela da campanha responde "qual vídeo vende mais". Esta responde a
 * pergunta seguinte, que é a que muda o criativo: **onde as pessoas deste
 * vídeo desistem**. Um vídeo que traz 200 e perde 180 na primeira cena tem
 * problema de promessa; um que perde na oferta tem problema de preço. São
 * conclusões opostas, e o número agregado não distingue as duas.
 */
export default async function Pagina({
  params,
}: {
  params: Promise<{ id: string; pecaId: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const { id, pecaId } = await params;
  const campanha = buscarCampanha(id);
  if (!campanha) notFound();

  // `sem-peca` na URL é o tráfego que chegou pelo link da campanha sem código
  // de vídeo — o da bio, tipicamente. Não é erro: é uma origem de verdade.
  const funil = funilDaPeca(id, pecaId === 'sem-peca' ? null : pecaId);
  if (!funil) notFound();

  const topo = funil.degraus[0]?.pessoas ?? 0;

  return (
    <main className="flex flex-col gap-5 p-5 max-w-3xl">
      <div className="flex flex-col gap-1">
        <Link
          href={`/painel/campanhas/${id}`}
          className="font-corpo text-[11px] text-pergaminho/40 hover:text-vela transition"
        >
          ← {campanha.nome}
        </Link>
        <h1 className="font-corpo text-lg text-pergaminho">
          {funil.codigo !== '—' && (
            <span className="text-pergaminho/40 font-mono text-sm mr-2">{funil.codigo}</span>
          )}
          {funil.nome}
        </h1>
        <p className="font-mono text-[10px] text-pergaminho/35 break-all">{funil.link}</p>
      </div>

      <Bloco titulo="Onde as pessoas param" nota="Uma pessoa conta uma vez por degrau.">
        <div className="flex flex-col gap-2">
          {funil.degraus.map((d) => {
            const largura = topo > 0 ? Math.max((d.pessoas / topo) * 100, d.pessoas > 0 ? 2 : 0) : 0;
            const perdeu = d.retencao !== null && d.retencao < 50;
            return (
              <div key={d.rotulo} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-corpo text-[12px] text-pergaminho/75">{d.rotulo}</span>
                  <span className="font-corpo text-[12px] tabular-nums text-pergaminho">
                    {d.pessoas}
                    {d.retencao !== null && (
                      <span
                        className="ml-2 text-[11px]"
                        style={{ color: perdeu ? '#e06c6c' : 'var(--pergaminho-45, rgba(234,224,204,0.45))' }}
                      >
                        {d.retencao.toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-pergaminho/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${largura}%`, background: OURO }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Bloco>

      {/*
        A Meta distribui sozinha entre Feed do Instagram e do Facebook, e o
        mesmo criativo rende diferente em cada um. Sem esta quebra, um vídeo
        que converte bem numa rede e mal na outra aparece como mediano nas
        duas — e a decisão de pausar sai errada.
      */}
      <Bloco titulo="De qual rede vieram" nota="Origem do primeiro toque de cada pessoa.">
        {funil.redes.length === 0 ? (
          <p className="font-corpo text-[12px] text-pergaminho/40">
            Ninguém chegou por este link ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {funil.redes.map((r) => (
              <li key={r.origem} className="flex justify-between font-corpo text-[12px]">
                <span className="text-pergaminho/70">{r.origem}</span>
                <span className="tabular-nums text-pergaminho">{r.pessoas}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Resultado">
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="font-corpo text-[11px] text-pergaminho/40">vendas</span>
            <span className="font-corpo text-lg tabular-nums" style={{ color: OURO }}>
              {funil.vendas}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-corpo text-[11px] text-pergaminho/40">receita</span>
            <span className="font-corpo text-lg tabular-nums" style={{ color: OURO }}>
              {brl(funil.receitaCentavos)}
            </span>
          </div>
        </div>
      </Bloco>
    </main>
  );
}
