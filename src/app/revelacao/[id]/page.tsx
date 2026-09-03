import Link from 'next/link';
import { buscarPedido } from '@/lib/db';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import type { Leitura } from '@/lib/leitura';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { RodapeLegal } from '@/components/RodapeLegal';
import { AcessoExpirado } from '@/components/AvisoDeExpiracao';
import { linkPublicoExpirou, produtoDe } from '@/lib/produtos';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { comentarioDoPedido } from '@/lib/db';
import { PedidoDeOpiniao } from '@/components/PedidoDeOpiniao';
import { buscarConta } from '@/lib/autenticacao';
import { compararAcessoEmSombra } from '@/nucleo/sombra';
import { MarcaCompra } from '@/components/MarcaCompra';
import { CorpoDaRevelacao } from '@/components/revelacao/CorpoDaRevelacao';

/**
 * Metadados por revelação: o card mostra o familiar DA PESSOA.
 *
 * É a diferença entre "olha esse site" e "olha o que me encontrou" — e é o que
 * faz o link circular. `robots` continua bloqueando indexação: a revelação é
 * para ser compartilhada por quem quiser, não para aparecer no Google.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);

  const padrao = { robots: { index: false, follow: false } };
  if (!pedido || pedido.status !== 'entregue' || !pedido.leitura_json) return padrao;

  const leitura: Leitura = JSON.parse(pedido.leitura_json);
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];
  const titulo = `${familiar.nome} · ${leitura.nome_secreto}`;

  return {
    ...padrao,
    title: `O familiar de ${pedido.nome}`,
    description: leitura.frase_de_invocacao,
    openGraph: {
      title: `O familiar de ${pedido.nome}: ${titulo}`,
      description: leitura.frase_de_invocacao,
      images: [
        { url: `/api/storage/${id}/og.png`, width: 1200, height: 630 },
      ],
    },
  };
}

export default async function Revelacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);

  if (!pedido || pedido.status !== 'entregue' || !pedido.leitura_json) {
    return (
      <main className="quarto-de-vela flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <h1 className="font-display italic text-2xl text-pergaminho">
          Esta revelação ainda não chegou.
        </h1>
        <Link href="/" className="font-corpo text-sm text-violeta underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  /**
   * O prazo vale para ESTRANHOS, nunca para a dona.
   *
   * Ela comprou; o que expira é a possibilidade de mostrar a outra pessoa. Se
   * a checagem não olhasse a sessão, o produto trancaria a cliente para fora
   * do que ela pagou — que é o pior desfecho possível aqui.
   *
   * A verificação roda no SERVIDOR, antes de renderizar: esconder no cliente
   * deixaria a leitura inteira no HTML de quem não pode ver.
   */
  const sessao = await sessaoAtual();
  const ehADona =
    !!sessao &&
    (sessao.tipo === 'admin' ||
      sessao.email.toLowerCase() === pedido.email.toLowerCase());

  if (linkPublicoExpirou(pedido.expira_em) && !ehADona) {
    return <AcessoExpirado pedidoId={id} />;
  }

  const leitura: Leitura = JSON.parse(pedido.leitura_json);
  const produto = produtoDe(pedido.produto);

  // Fase 2 de docs/reestruturacao.md: compara em sombra o que produtos.ts
  // decidiu aqui contra o que o núcleo novo (acesso.ts) diria — nunca decide
  // nada, só registra divergência quando já dá pra comparar de verdade.
  if (ehADona) {
    const conta = buscarConta(pedido.email);
    if (conta) {
      compararAcessoEmSombra(conta.id, pedido.id, {
        pdf: produto.pdf,
        imagens: produto.imagens,
        relatorioCompleto: produto.relatorioCompleto,
        graficos: produto.graficos,
        perfilPublico: produto.perfilPublico,
        tiragemDiaria: produto.tiragemDiaria,
        narracaoAudio: produto.narracaoAudio,
      });
    }
  }

  return (
    <>
      <PoeiraNaLuz />

      {/*
        Só a DONA dispara `Purchase` — este link é compartilhável, e quem
        recebe de outra pessoa vê a mesma página sem ter comprado nada. Sem
        essa guarda, cada visualização de quem recebeu o link contaria como
        uma nova venda. `exemplo` também fica de fora: é amostra nossa para o
        mural, não cliente de verdade.

        O `event_id` dentro de `MarcaCompra` é o que faz este disparo e o de
        `/obrigado` serem o mesmo acontecimento aos olhos da Meta.
      */}
      {ehADona && !pedido.exemplo && (
        <MarcaCompra
          pedidoId={id}
          valorEmReais={(pedido.bruto_centavos ?? produto.precoCentavos) / 100}
        />
      )}

      {/*
        A composição segue a regra da estética: o que é grimório vai DENTRO da
        folha; o que é interface fica fora dela, no quarto.

        O corpo é o MESMO objeto que a plataforma monta em
        `/conta/familiar/[id]` — ver `CorpoDaRevelacao`. Esta página é a moldura
        pública dele: a que tem prazo, a que circula, a que um estranho pode
        abrir.
      */}
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center px-5 pt-10 pb-16 gap-8 sm:gap-12 sm:pt-16">
        <CorpoDaRevelacao
          pedido={pedido}
          leitura={leitura}
          ehADona={ehADona}
          temSessaoDeConta={sessao?.tipo === 'conta'}
          contexto="publico"
        />

        <RodapeLegal />
      </main>

      {/*
        Só quem comprou é convidado a opinar, e só quem está logado consegue
        de fato enviar (a rota confere a sessão). Sem isso, o mural viraria
        caixa de texto pública para qualquer um que receba o link.
      */}
      {ehADona && sessao?.tipo === 'conta' && (
        <PedidoDeOpiniao pedidoId={id} jaComentou={!!comentarioDoPedido(id)} />
      )}
    </>
  );
}
