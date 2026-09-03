import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buscarPedido, comentarioDoPedido } from '@/lib/db';
import type { Leitura } from '@/lib/leitura';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { CorpoDaRevelacao } from '@/components/revelacao/CorpoDaRevelacao';
import { PedidoDeOpiniao } from '@/components/PedidoDeOpiniao';
import { estadoDoDownload } from '@/nucleo/carencia';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';

/**
 * A revelação DENTRO da plataforma.
 *
 * ── Por que ela deixou de ser só um link ──────────────────────────────────
 *
 * Até aqui quem comprava recebia um endereço público e ia embora com ele. A
 * plataforma existia do lado, e a pessoa só a encontrava horas depois, por um
 * e-mail que chegava quando a atenção já tinha acabado. O produto inteiro —
 * Oráculo, calendário, estante — ficava atrás de uma porta que ninguém tinha
 * dito que existia.
 *
 * Agora é o contrário: pagou, entra. A revelação é a primeira sala, e as
 * outras estão no menu ao lado dela. Não há nada aqui que a pessoa não tenha
 * comprado; o que mudou é ela ver, no mesmo minuto, o tamanho do lugar onde
 * a compra a colocou.
 *
 * `/revelacao/[id]` continua existindo e continua público: é o que circula.
 * Esta tela é a mesma coisa vista de dentro de casa.
 *
 * ── O prazo não vale aqui ─────────────────────────────────────────────────
 *
 * `linkPublicoExpirou` é a regra do link que se compartilha, e ela nunca
 * valeu para a dona. Aqui só entra a dona (o layout exige sessão, e a consulta
 * confere o e-mail), então a checagem sequer aparece: uma revelação que some
 * da estante de quem pagou é o pior desfecho possível deste produto.
 */
export default async function FamiliarDaConta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessao = await sessaoAtual();

  /**
   * O layout já barra quem não tem sessão, mas em Next 16 layout e página
   * renderizam em paralelo — sem esta saída o corpo executa uma vez com
   * `sessao` nula e enche o log de erro. Ver `/conta/familiar/page.tsx`.
   */
  if (!sessao) return null;

  const pedido = buscarPedido(id);
  if (!pedido || pedido.status !== 'entregue' || !pedido.leitura_json) notFound();

  /**
   * Dono, sempre pelo e-mail da sessão.
   *
   * `notFound()` e não uma mensagem de "isto não é seu": a existência de um
   * pedido alheio não é assunto de ninguém, e responder diferente para id que
   * existe e id que não existe transforma esta rota num verificador de
   * pedidos para quem quiser sondar.
   *
   * Admin entra — é o que permite atender uma reclamação olhando a mesma tela
   * que a pessoa está vendo.
   */
  const ehADona =
    sessao.tipo === 'admin' ||
    sessao.email.toLowerCase() === pedido.email.toLowerCase();
  if (!ehADona) notFound();

  const leitura: Leitura = JSON.parse(pedido.leitura_json);
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];
  const download = estadoDoDownload(pedido.pago_em);

  return (
    <section className="w-full flex flex-col items-center gap-8 sm:gap-12">
      <CorpoDaRevelacao
        pedido={pedido}
        leitura={leitura}
        ehADona
        temSessaoDeConta={sessao.tipo === 'conta'}
        contexto="app"
      />

      <ArquivoGuardado
        pedidoId={id}
        nomeDoArquivo={`bruxario-${(familiar?.nome ?? 'familiar').toLowerCase().replace(/\s+/g, '-')}.pdf`}
        liberado={download.liberado}
        diasQueFaltam={download.diasQueFaltam}
      />

      <Link
        href="/conta/familiar"
        className="font-corpo text-sm text-pergaminho/50 hover:text-pergaminho transition-colors"
      >
        ← todos os seus familiares
      </Link>

      {sessao.tipo === 'conta' && (
        <PedidoDeOpiniao pedidoId={id} jaComentou={!!comentarioDoPedido(id)} />
      )}
    </section>
  );
}

/**
 * O PDF, que agora chega depois.
 *
 * ── Por que ele não sai mais no primeiro minuto ───────────────────────────
 *
 * Ver `nucleo/carencia.ts`. O resumo: o arquivo era o convite para fechar a
 * aba, e quem fecha a aba no primeiro dia não descobriu nada do resto. Sete
 * dias depois ele deixa de ser a saída e vira a lembrança.
 *
 * ── Por que dizer que ele existe, em vez de escondê-lo ────────────────────
 *
 * Um botão que aparece do nada uma semana depois não é notado por ninguém. A
 * espera contada em dias é o oposto: ela promete uma coisa que vai chegar, e
 * dá motivo para voltar. O que não se anuncia não é presente, é acaso.
 */
function ArquivoGuardado({
  pedidoId,
  nomeDoArquivo,
  liberado,
  diasQueFaltam,
}: {
  pedidoId: string;
  nomeDoArquivo: string;
  liberado: boolean;
  diasQueFaltam: number;
}) {
  if (liberado) {
    return (
      <a
        href={`/api/storage/${pedidoId}/revelacao.pdf`}
        download={nomeDoArquivo}
        className="font-corpo text-sm px-6 py-2.5 rounded-full border border-pergaminho/20 text-pergaminho/65 hover:border-pergaminho/45 hover:text-pergaminho transition-colors"
      >
        Guardar em PDF
      </a>
    );
  }

  /**
   * Quem não pagou (cortesia, entrega gratuita) não vê promessa nenhuma:
   * `diasQueFaltam` é zero e não há data para prometer. Silêncio é melhor do
   * que "seu arquivo chega em 0 dias".
   */
  if (diasQueFaltam === 0) return null;

  return (
    <p className="font-corpo text-xs text-pergaminho/40 text-center max-w-[30ch] leading-relaxed">
      A cópia em PDF fica pronta para guardar{' '}
      {diasQueFaltam === 1 ? 'amanhã' : `em ${diasQueFaltam} dias`}. Até lá ela
      mora aqui.
    </p>
  );
}
