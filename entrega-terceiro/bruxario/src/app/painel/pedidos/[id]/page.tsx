import { notFound, redirect } from 'next/navigation';
import { buscarPedido } from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { PRODUTOS, precoFormatado } from '@/lib/produtos';
import { precoDoPedido } from '@/lib/cupons';
import { BotaoEstornar } from '@/components/BotaoEstornar';
import { Bloco, Cartao, brl, OURO, VERMELHO } from '@/components/painel/GraficosPeriodo';
import { LinhaDoTempo } from '@/components/painel/LinhaDoTempo';
import { linhaDoTempoDoPedido } from '@/nucleo/linha-do-tempo';
import { dataHoraBr } from '@/lib/periodo';

export const metadata = { title: 'Pedido', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A linha de vida da venda — docs/reestruturacao.md, Fase 1.
 *
 * "Onde essa venda parou, e o que foi tentado desde então?" hoje exige olhar
 * cinco lugares (rastreio, marcos, eventos, fila do pixel, anomalias). Esta
 * tela junta os cinco numa página só, pelo id do pedido.
 */
export default async function DetalheDoPedido({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  const produto = PRODUTOS[pedido.produto] ?? PRODUTOS.revelacao;
  const preco = precoDoPedido(pedido);
  const valorCobrado = pedido.bruto_centavos ?? preco.finalCentavos;
  const podeEstornar = pedido.status === 'entregue' || pedido.status === 'pago';
  const passos = linhaDoTempoDoPedido(id);

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <p className="font-corpo text-[11px] uppercase tracking-wider text-pergaminho/40">
            Pedido
          </p>
          <h1 className="font-display italic text-2xl text-pergaminho">{pedido.nome}</h1>
          <p className="font-corpo text-[11px] text-pergaminho/45 font-mono">{pedido.id}</p>
        </div>
        {podeEstornar && (
          <BotaoEstornar pedidoId={pedido.id} valor={`R$ ${precoFormatado(produto)}`} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Cartao rotulo="Situação" valor={pedido.status} cor={pedido.status === 'entregue' ? OURO : undefined} />
        <Cartao rotulo="Produto" valor={produto.nome} />
        <Cartao rotulo="Cobrado" valor={brl(valorCobrado)} />
        <Cartao
          rotulo="Método"
          valor={pedido.metodo_pagamento ?? pedido.metodo_tentado ?? '—'}
        />
      </div>

      <Bloco titulo="Dados" nota="O que o pedido guarda, sem passar pela linha do tempo.">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 font-corpo text-[12px]">
          <Linha rotulo="E-mail" valor={pedido.email || '—'} />
          <Linha rotulo="Familiar" valor={pedido.familiar} />
          <Linha rotulo="Cupom" valor={pedido.cupom ?? '—'} />
          <Linha rotulo="Desconto" valor={pedido.desconto_percentual ? `${pedido.desconto_percentual}%` : '—'} />
          <Linha rotulo="Campanha" valor={pedido.campanha_id ?? '—'} />
          <Linha rotulo="Funil" valor={pedido.funil ?? '—'} />
          <Linha rotulo="Criado" valor={dataHoraBr(pedido.criado_em)} />
          <Linha rotulo="Pago em" valor={pedido.pago_em ? dataHoraBr(pedido.pago_em) : '—'} />
          <Linha rotulo="Expira em" valor={pedido.expira_em ? dataHoraBr(pedido.expira_em) : 'nunca'} />
          <Linha rotulo="Tentativas" valor={String(pedido.tentativas)} />
          <Linha
            rotulo="Motivo de recusa"
            valor={pedido.motivo_recusa ?? '—'}
            cor={pedido.motivo_recusa ? VERMELHO : undefined}
          />
        </dl>
      </Bloco>

      <Bloco
        titulo="Linha do tempo"
        nota="Marketing, funil, sistema, pixel e Sentinela — na ordem em que aconteceram."
      >
        <LinhaDoTempo passos={passos} />
      </Bloco>
    </div>
  );
}

function Linha({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] uppercase tracking-wider text-pergaminho/40">{rotulo}</dt>
      <dd className="text-pergaminho/80 truncate" style={cor ? { color: cor } : undefined}>
        {valor}
      </dd>
    </div>
  );
}
