import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { contatos, listarEnvios } from '@/lib/remarketing';
import db from '@/lib/db';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { ITENS } from '@/lib/quiz/itens';
import { precoDoPedido } from '@/lib/cupons';
import { dataHoraBr } from '@/lib/periodo';
import { Bloco, Cartao, brl, OURO, VERDE, VERMELHO } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Pessoa', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A ficha de uma pessoa: tudo que sabemos sobre ela num lugar só.
 *
 * Serve para duas coisas: decidir se vale mandar oferta (e qual), e responder
 * suporte sem abrir o banco no SSH — "essa pessoa já comprou?", "até onde ela
 * foi?", "o cartão dela recusou por quê?".
 */
export default async function FichaDaPessoa({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const { email: bruto } = await params;
  const email = decodeURIComponent(bruto).toLowerCase();

  const pessoa = contatos().find((c) => c.email === email);
  if (!pessoa) notFound();

  const pedidos = db
    .prepare(
      `SELECT id, nome, familiar, produto, status, desconto_percentual, cupom,
              bruto_centavos, taxa_centavos, metodo_tentado, metodo_pagamento,
              motivo_recusa, tentativas_pagamento, respostas_json, origem,
              criado_em, pago_em
         FROM pedidos WHERE lower(email) = ? ORDER BY criado_em DESC`
    )
    .all(email) as {
    id: string;
    nome: string;
    familiar: string;
    produto: string;
    status: string;
    desconto_percentual: number | null;
    cupom: string | null;
    bruto_centavos: number | null;
    taxa_centavos: number | null;
    metodo_tentado: string | null;
    metodo_pagamento: string | null;
    motivo_recusa: string | null;
    tentativas_pagamento: number;
    respostas_json: string;
    origem: string | null;
    criado_em: string;
    pago_em: string | null;
  }[];

  const envios = listarEnvios().filter((e) => e.email === email);
  const ultimo = pedidos[0];

  // As respostas do teste, em palavras — é o material que a IA usa para
  // escrever o e-mail, então ver aqui explica o texto que ela produziu.
  let respostas: { cena: string; escolha: string }[] = [];
  if (ultimo) {
    try {
      const escolhas = JSON.parse(ultimo.respostas_json).quiz as Record<string, number>;
      respostas = ITENS.map((item) => {
        const e = escolhas?.[item.id];
        const o = typeof e === 'number' ? item.opcoes[e] : undefined;
        return o ? { cena: item.cena, escolha: o.texto } : null;
      }).filter(Boolean) as { cena: string; escolha: string }[];
    } catch {
      respostas = [];
    }
  }

  const familiar = ultimo ? FAMILIARES[ultimo.familiar as FamiliarId] : null;

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display italic text-2xl text-pergaminho">
            {pessoa.nome ?? pessoa.email}
          </h1>
          <p className="font-corpo text-xs text-pergaminho/45">
            {pessoa.email}
            {pessoa.origem ? ` · veio de ${pessoa.origem}` : ''}
            {` · primeira vez ${dataHoraBr(pessoa.primeiraVez)}`}
          </p>
          {pessoa.descadastrado && (
            <p className="font-corpo text-xs" style={{ color: VERMELHO }}>
              Pediu para não receber mais ofertas.
            </p>
          )}
        </div>
        <Link href="/painel/remarketing"
          className="font-corpo text-xs text-pergaminho/45 hover:text-vela underline underline-offset-4 transition">
          voltar
        </Link>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Cartao rotulo="Foi até" valor={pessoa.cenaMaxima > 0 ? `cena ${pessoa.cenaMaxima}` : '—'} />
        <Cartao rotulo="Situação"
          valor={pessoa.comprou.length ? 'cliente' : pessoa.abriuCheckout ? 'quase' : 'parou antes'}
          cor={pessoa.comprou.length ? VERDE : pessoa.abriuCheckout ? OURO : undefined} />
        <Cartao rotulo="Gastou" valor={pessoa.gastouCentavos > 0 ? brl(pessoa.gastouCentavos) : '—'} />
        <Cartao rotulo="Familiar" valor={familiar?.nome ?? '—'} />
        <Cartao rotulo="Pedidos" valor={String(pedidos.length)} />
        <Cartao rotulo="Ofertas recebidas" valor={String(pessoa.jaRecebeu)} />
      </div>

      {pedidos.length > 0 && (
        <Bloco titulo="Pedidos e tentativas de pagamento"
          nota="O método tentado e o motivo da recusa só existem em pedidos criados depois de 07/08 — antes disso a informação não era gravada.">
          <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--admin-borda)' }}>
            <table className="w-full border-collapse font-corpo text-[11px] min-w-[44rem]">
              <thead>
                <tr className="text-pergaminho/40">
                  {['quando', 'produto', 'situação', 'valor', 'tentou por', 'recusa', 'cupom'].map((c) => (
                    <th key={c} className="text-left font-medium px-2.5 py-2 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-pergaminho/75">
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: 'var(--admin-borda)' }}>
                    <td className="px-2.5 py-1.5 whitespace-nowrap text-pergaminho/50">
                      {dataHoraBr(p.criado_em)}
                    </td>
                    <td className="px-2.5 py-1.5">{p.produto}</td>
                    <td className="px-2.5 py-1.5"
                      style={{ color: p.status === 'entregue' ? OURO : undefined }}>
                      {p.status}
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums whitespace-nowrap">
                      {brl(p.bruto_centavos ?? precoDoPedido(p).finalCentavos)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {p.metodo_pagamento ?? p.metodo_tentado ?? '—'}
                      {p.tentativas_pagamento > 1 && (
                        <span className="text-pergaminho/40"> ({p.tentativas_pagamento}×)</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5" style={{ color: p.motivo_recusa ? VERMELHO : undefined }}>
                      {p.motivo_recusa ?? '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-pergaminho/50">{p.cupom ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloco>
      )}

      {envios.length > 0 && (
        <Bloco titulo="Ofertas já mandadas para este endereço">
          <div className="flex flex-col gap-2">
            {envios.map((e) => (
              <div key={e.id} className="rounded-lg border px-3 py-2 flex flex-col gap-1"
                style={{ borderColor: 'var(--admin-borda)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-corpo text-xs text-vela">{e.assunto}</span>
                  <span className="font-corpo text-[11px] text-pergaminho/40">
                    {e.status}
                    {e.enviado_em ? ` · ${dataHoraBr(e.enviado_em)}` : ''}
                    {e.cupom ? ` · ${e.cupom}` : ''}
                  </span>
                </div>
                {e.erro && (
                  <span className="font-corpo text-[11px]" style={{ color: VERMELHO }}>
                    {e.erro}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Bloco>
      )}

      {respostas.length > 0 && (
        <Bloco titulo="O que ela respondeu no teste"
          nota="É este material que a IA usa para escrever o e-mail dela.">
          <ul className="flex flex-col gap-2">
            {respostas.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="font-display italic text-[13px] text-pergaminho/70">
                  {r.cena}
                </span>
                <span className="font-corpo text-[11px] text-vela/80">→ {r.escolha}</span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}
    </div>
  );
}
