import { redirect } from 'next/navigation';
import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { PRODUTOS, precoFormatado, type ProdutoId } from '@/lib/produtos';
import { precoDoPedido } from '@/lib/cupons';
import { BotaoEstornar } from '@/components/BotaoEstornar';
import { Bloco, Cartao, brl, OURO, VERMELHO } from '@/components/painel/GraficosPeriodo';
import { dataHoraBr } from '@/lib/periodo';

export const metadata = { title: 'Pedidos', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Os pedidos. **Leitura, com uma exceção: o estorno.**
 *
 * O SPEC decidiu não ter admin que edita, para reduzir superfície de ataque.
 * Devolver dinheiro é a única coisa que vale abrir exceção — fazer isso por
 * SSH, na mão, no meio de uma reclamação, é pior que um botão com confirmação
 * (a rota exige sessão de admin e confirmação literal no corpo).
 */
export default async function Pedidos() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const porStatus = db
    .prepare('SELECT status, count(*) n FROM pedidos WHERE exemplo = 0 GROUP BY status')
    .all() as { status: string; n: number }[];

  // A receita sai do valor REALMENTE cobrado, pedido a pedido, e não do preço
  // de tabela vezes a quantidade. Com cupons circulando, a segunda conta
  // superestima — e um painel que infla o próprio faturamento é pior que um
  // painel sem número nenhum.
  const pagos = db
    .prepare(
      `SELECT produto, desconto_percentual, bruto_centavos, taxa_centavos,
              liquido_centavos, custo_ia_centavos
         FROM pedidos WHERE status = 'entregue' AND exemplo = 0`
    )
    .all() as {
    produto: string;
    desconto_percentual: number | null;
    bruto_centavos: number | null;
    taxa_centavos: number | null;
    liquido_centavos: number | null;
    custo_ia_centavos: number;
  }[];

  const bruto = pagos.reduce(
    (s, p) => s + (p.bruto_centavos ?? precoDoPedido(p).finalCentavos),
    0
  );
  const taxas = pagos.reduce((s, p) => s + (p.taxa_centavos ?? 0), 0);
  const custoIa = pagos.reduce((s, p) => s + (p.custo_ia_centavos ?? 0), 0);

  const travados = db
    .prepare(
      `SELECT id, status, tentativas, criado_em FROM pedidos
        WHERE status IN ('pago','gerando','erro') ORDER BY criado_em DESC LIMIT 10`
    )
    .all() as { id: string; status: string; tentativas: number; criado_em: string }[];

  const recentes = db
    .prepare(
      `SELECT id, nome, email, familiar, produto, status, criado_em, metodo_pagamento,
              bruto_centavos, desconto_percentual
         FROM pedidos ORDER BY criado_em DESC LIMIT 40`
    )
    .all() as {
    id: string;
    nome: string;
    email: string;
    familiar: string;
    produto: ProdutoId;
    status: string;
    criado_em: string;
    metodo_pagamento: string | null;
    bruto_centavos: number | null;
    desconto_percentual: number | null;
  }[];

  // Quem comprou mais de uma vez. É a pergunta que o suporte faz primeiro
  // quando alguém escreve — "essa pessoa já tinha comprado antes?".
  const recorrentes = db
    .prepare(
      `SELECT lower(email) email, count(*) n FROM pedidos
        WHERE status = 'entregue' GROUP BY lower(email) HAVING n > 1
        ORDER BY n DESC LIMIT 10`
    )
    .all() as { email: string; n: number }[];

  const contas = db.prepare('SELECT count(*) n FROM contas').get() as { n: number };
  const entregues = porStatus.find((s) => s.status === 'entregue')?.n ?? 0;

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Cartao rotulo="Entregues" valor={String(entregues)} cor={OURO} />
        <Cartao rotulo="Bruto" valor={brl(bruto)} />
        <Cartao rotulo="Taxas do MP" valor={brl(taxas)} cor={VERMELHO} />
        <Cartao rotulo="Custo de IA" valor={brl(custoIa)} cor={VERMELHO} />
        <Cartao rotulo="Sobrou" valor={brl(bruto - taxas - custoIa)} />
        <Cartao rotulo="Contas" valor={String(contas.n)} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {porStatus
          .filter((s) => s.status !== 'entregue')
          .map((s) => (
            <Cartao key={s.status} rotulo={s.status} valor={String(s.n)} />
          ))}
      </div>

      {travados.length > 0 && (
        <Bloco titulo={`Travados (${travados.length})`}
          nota="Pago mas não entregue. O job de reprocessamento pega até 3 tentativas; acima disso é erro que precisa de olho.">
          <Tabela
            cabecalho={['pedido', 'estado', 'tentativas', 'quando']}
            linhas={travados.map((t) => [
              t.id.slice(0, 8), t.status, String(t.tentativas), dataHoraBr(t.criado_em),
            ])}
          />
        </Bloco>
      )}

      <Bloco titulo="Últimos pedidos"
        nota="Estornar devolve o dinheiro pelo Mercado Pago. A revelação continua acessível para quem comprou — tirar o produto de quem já leu não recupera nada.">
        <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--admin-borda)' }}>
          <table className="w-full border-collapse font-corpo text-[11px] min-w-[48rem]">
            <thead>
              <tr className="text-pergaminho/40">
                {['pedido', 'nome', 'e-mail', 'produto', 'valor', 'via', 'situação', 'quando', ''].map((c) => (
                  <th key={c} scope="col" className="text-left font-medium px-2.5 py-2 whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-pergaminho/75">
              {recentes.map((p) => {
                const produto = PRODUTOS[p.produto];
                const podeEstornar = p.status === 'entregue' || p.status === 'pago';
                const valor = p.bruto_centavos ?? precoDoPedido(p).finalCentavos;
                return (
                  <tr key={p.id} className="border-t hover:bg-pergaminho/[0.03]"
                    style={{ borderColor: 'var(--admin-borda)' }}>
                    <td className="px-2.5 py-1.5 font-mono text-[10px]">
                      <Link
                        href={`/painel/pedidos/${p.id}`}
                        className="text-pergaminho/40 hover:text-vela transition"
                        title="Ver a linha do tempo deste pedido"
                      >
                        {p.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{p.nome}</td>
                    <td className="px-2.5 py-1.5 max-w-[14rem] truncate">{p.email}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{produto?.nome ?? p.produto}</td>
                    <td className="px-2.5 py-1.5 tabular-nums whitespace-nowrap">{brl(valor)}</td>
                    <td className="px-2.5 py-1.5 text-pergaminho/50">{p.metodo_pagamento ?? '—'}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap"
                      style={{ color: p.status === 'entregue' ? OURO : undefined }}>
                      {p.status}
                    </td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-pergaminho/45">
                      {dataHoraBr(p.criado_em)}
                    </td>
                    <td className="px-2.5 py-1.5">
                      {podeEstornar && (
                        <BotaoEstornar pedidoId={p.id}
                          valor={`R$ ${precoFormatado(produto ?? PRODUTOS.revelacao)}`} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Bloco>

      {recorrentes.length > 0 && (
        <Bloco titulo="Compraram mais de uma vez">
          <Tabela
            cabecalho={['e-mail', 'compras']}
            linhas={recorrentes.map((r) => [r.email, String(r.n)])}
          />
        </Bloco>
      )}

      <Bloco titulo="Preços em vigor">
        <Tabela
          cabecalho={['produto', 'preço', 'link público', 'narração']}
          linhas={Object.values(PRODUTOS).map((p) => [
            p.nome,
            `R$ ${precoFormatado(p)}`,
            p.diasDeLinkPublico === null ? 'permanente' : `${p.diasDeLinkPublico} dias`,
            p.narracaoAudio ? 'sim' : '—',
          ])}
        />
      </Bloco>
    </div>
  );
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: string[][] }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--admin-borda)' }}>
      <table className="w-full border-collapse font-corpo text-[11px]">
        <thead>
          <tr className="text-pergaminho/40">
            {cabecalho.map((c) => (
              <th key={c} scope="col" className="text-left font-medium px-2.5 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-pergaminho/75">
          {linhas.map((l, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'var(--admin-borda)' }}>
              {l.map((c, j) => (
                <td key={j} className="px-2.5 py-1.5 whitespace-nowrap">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
