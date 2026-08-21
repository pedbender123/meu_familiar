import Link from 'next/link';
import { redirect } from 'next/navigation';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { precoDoPedido } from '@/lib/preco';

export const metadata = { title: 'Pedidos', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

interface Linha {
  id: string;
  nome: string;
  email: string;
  familiar: string;
  produto: string;
  status: string;
  desconto_percentual: number | null;
  bruto_centavos: number | null;
  criado_em: string;
}

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * A lista de pedidos — a tela que responde "está vendendo e entregando?".
 *
 * O `status` é a coluna que importa: pedido parado em `aguardando_pagamento`
 * é carrinho abandonado, e pedido em `erro` é venda paga que não foi
 * entregue. Esses são os dois que exigem ação.
 */
export default async function Pedidos() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const pedidos = db
    .prepare(
      `SELECT id, nome, email, familiar, produto, status, desconto_percentual,
              bruto_centavos, criado_em
         FROM pedidos WHERE exemplo = 0
        ORDER BY criado_em DESC LIMIT 200`
    )
    .all() as Linha[];

  const pagos = pedidos.filter((p) => p.status === 'entregue' || p.status === 'pago');
  const receita = pagos.reduce(
    (s, p) => s + (p.bruto_centavos ?? precoDoPedido(p).finalCentavos),
    0
  );
  const comErro = pedidos.filter((p) => p.status === 'erro').length;

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto">
      <div className="grid grid-cols-3 gap-3">
        <Cartao rotulo="Vendas" valor={String(pagos.length)} />
        <Cartao rotulo="Receita" valor={reais(receita)} destaque />
        <Cartao rotulo="Com erro" valor={String(comErro)} alerta={comErro > 0} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm font-corpo">
          <thead>
            <tr className="text-left text-pergaminho/40 text-xs">
              <th className="py-2 pr-3 font-normal">Quando</th>
              <th className="py-2 pr-3 font-normal">Quem</th>
              <th className="py-2 pr-3 font-normal">Familiar</th>
              <th className="py-2 pr-3 font-normal">Status</th>
              <th className="py-2 font-normal text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id} className="border-t border-pergaminho/10">
                <td className="py-2 pr-3 text-pergaminho/45 whitespace-nowrap">
                  {new Date(p.criado_em).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </td>
                <td className="py-2 pr-3 text-pergaminho/85 max-w-[22ch] truncate">
                  <Link href={`/painel/pedidos/${p.id}`} className="hover:text-vela">
                    {p.email}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-pergaminho/55">{p.familiar}</td>
                <td className="py-2 pr-3">
                  <Estado status={p.status} />
                </td>
                <td className="py-2 text-right text-pergaminho/70 tabular-nums">
                  {reais(p.bruto_centavos ?? precoDoPedido(p).finalCentavos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pedidos.length === 0 && (
          <p className="py-10 text-center font-corpo text-sm text-pergaminho/30">
            Nenhum pedido ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function Estado({ status }: { status: string }) {
  const cor =
    status === 'entregue'
      ? 'text-emerald-400'
      : status === 'erro'
        ? 'text-red-400'
        : status === 'aguardando_pagamento'
          ? 'text-pergaminho/35'
          : 'text-vela';
  return <span className={`font-corpo text-xs ${cor}`}>{status}</span>;
}

function Cartao({
  rotulo,
  valor,
  destaque,
  alerta,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-xl border"
      style={{
        borderColor: alerta
          ? 'rgba(248,113,113,0.4)'
          : destaque
            ? 'rgba(217,164,65,0.4)'
            : 'rgba(234,224,204,0.12)',
      }}
    >
      <span className="font-corpo text-[0.6rem] tracking-[0.16em] uppercase text-pergaminho/40">
        {rotulo}
      </span>
      <span
        className={`font-display text-xl tabular-nums ${
          alerta ? 'text-red-400' : destaque ? 'text-vela' : 'text-pergaminho'
        }`}
      >
        {valor}
      </span>
    </div>
  );
}
