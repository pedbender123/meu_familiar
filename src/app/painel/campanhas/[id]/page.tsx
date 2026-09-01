import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import {
  buscarCampanha,
  janelaDaCampanha,
  relatorioDoPeriodo,
} from '@/lib/campanhas';
import { dataHoraBr, deUtcParaLocal, granularidade } from '@/lib/periodo';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import { TabelaDePessoas } from '@/components/painel/TabelaDePessoas';
import { EditarCampanha } from '@/components/painel/EditarCampanha';
import { Pecas } from '@/components/painel/Pecas';
import { desempenhoPorPeca } from '@/lib/campanhas';
import {
  Bloco,
  Cartao,
  BarrasRotuladas,
  CurvaDoRitual,
  FunilDoPeriodo,
  SerieDoPeriodo,
  Vazio,
  brl,
  OURO,
  VERDE,
  VERMELHO,
  VIOLETA,
} from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Relatório da campanha', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NOME_DA_ORIGEM: Record<string, string> = {
  tiktok: 'TikTok', instagram: 'Instagram', bio: 'Link da bio',
  stories: 'Stories', whatsapp: 'WhatsApp', youtube: 'YouTube',
  amigo: 'Indicação', direto: 'Direto', outro: 'Outros',
  '(direto)': 'Direto / sem origem',
};

/** Nomes que o Mercado Pago usa, traduzidos para leitura humana. */
const NOME_DO_METODO: Record<string, string> = {
  pix: 'Pix',
  master: 'Mastercard',
  visa: 'Visa',
  elo: 'Elo',
  amex: 'Amex',
  hipercard: 'Hipercard',
  bolbradesco: 'Boleto',
  account_money: 'Saldo Mercado Pago',
  debvisa: 'Visa débito',
  debmaster: 'Mastercard débito',
  fake: 'Modo teste',
};

/**
 * Os `status_detail` do MP que mais aparecem.
 *
 * A distinção que importa: recusa do EMISSOR (saldo, limite, cartão bloqueado)
 * é problema da pessoa e não tem o que consertar; recusa por dado MAL
 * PREENCHIDO (CVV, data, número) é problema de checkout — e aí vale mexer na
 * tela.
 */
const MOTIVO_DA_RECUSA: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Sem saldo/limite',
  cc_rejected_bad_filled_security_code: 'CVV errado (checkout)',
  cc_rejected_bad_filled_date: 'Validade errada (checkout)',
  cc_rejected_bad_filled_card_number: 'Número errado (checkout)',
  cc_rejected_bad_filled_other: 'Dado errado (checkout)',
  cc_rejected_high_risk: 'Recusado por risco',
  cc_rejected_call_for_authorize: 'Precisa autorizar no banco',
  cc_rejected_card_disabled: 'Cartão bloqueado',
  cc_rejected_duplicated_payment: 'Pagamento duplicado',
  cc_rejected_other_reason: 'Recusado pelo emissor',
};

/**
 * O relatório de uma campanha.
 *
 * ── O que este número NÃO é ───────────────────────────────────────────────
 *
 * Não é atribuição. O site não sabe quem veio do anúncio e quem digitou o
 * endereço — sabe quem entrou naquele intervalo. Numa janela de 4 horas de
 * anúncio isso é quase a mesma coisa; numa de uma semana, não é. A leitura
 * honesta é sempre comparativa: rode a mesma janela num dia parado e olhe a
 * diferença.
 *
 * O `de`/`até` fica visível no topo justamente para isso — o número só quer
 * dizer alguma coisa junto do intervalo que o gerou.
 */
export default async function RelatorioDaCampanha({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const { id } = await params;
  const campanha = buscarCampanha(id);
  if (!campanha) notFound();

  const janela = janelaDaCampanha(campanha);
  const gran = granularidade({ ...janela, rotulo: '' });
  /*
    O quarto argumento é o que separa "o que aconteceu no site nesta janela"
    de "o que esta campanha trouxe". Sem ele, o relatório somava quem digitou
    o endereço e quem veio da bio ao tráfego do anúncio — três coisas com
    custo diferente — e a conversão medida saía mais baixa do que a real.
  */
  const r = relatorioDoPeriodo(janela.de, janela.ate, gran.minutos, campanha.id);

  const investido = campanha.investido_centavos;

  /**
   * ── Assinatura entra na conta da campanha ─────────────────────────────
   *
   * Ela só passou a poder entrar agora: `cobrancas` guarda `campanha_id`
   * desde a migração 038, e antes disso somar receita de assinatura aqui
   * seria creditar à campanha dinheiro que talvez não fosse dela.
   *
   * Entra porque a alternativa é pior. Com a assinatura de fora, a campanha
   * que vende assinatura aparece com ROAS de uma fração do real — e a decisão
   * que sai de um ROAS subestimado é pausar o que está funcionando.
   *
   * A separação continua na tela, na linha logo abaixo dos números: o total
   * responde "valeu a pena", e o detalhe responde "de que tipo de receita".
   * Um número só, sem o detalhe, esconderia que parte disso é receita que se
   * repete e parte é receita que aconteceu uma vez.
   */
  const receitaTotal = r.brutoCentavos + r.receitaRecorrenteCentavos;
  const liquidoTotal =
    r.liquidoCentavos + (r.receitaRecorrenteCentavos - r.taxaRecorrenteCentavos);
  const vendasTotais = r.vendas + r.assinaturasNovas + r.renovacoes;

  const lucro = liquidoTotal - r.custoIaCentavos - investido;
  const custoPorPessoa = r.visitantes > 0 ? Math.round(investido / r.visitantes) : 0;
  const custoPorEmail = r.emailsCapturados > 0 ? Math.round(investido / r.emailsCapturados) : 0;
  const custoPorVenda = vendasTotais > 0 ? Math.round(investido / vendasTotais) : 0;
  const conversao = r.visitantes > 0 ? (vendasTotais / r.visitantes) * 100 : 0;
  const roas = investido > 0 ? receitaTotal / investido : 0;

  const horas =
    (new Date(janela.ate).getTime() - new Date(janela.de).getTime()) / 3600_000;

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1 className="font-display italic text-2xl sm:text-3xl text-pergaminho">
                {campanha.nome}
              </h1>
              {!campanha.fim && (
                <span className="font-corpo text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border"
                  style={{ color: OURO, borderColor: 'rgba(217,164,65,0.4)' }}>
                  no ar
                </span>
              )}
              <Link href="/painel/campanhas"
                className="font-corpo text-xs text-pergaminho/45 hover:text-vela underline underline-offset-4 transition">
                todas as campanhas
              </Link>
            </div>
            <p className="font-corpo text-xs text-pergaminho/45">
              {dataHoraBr(janela.de)} → {campanha.fim ? dataHoraBr(janela.ate) : 'agora'}
              {' · '}
              {horas < 48 ? `${horas.toFixed(1)} h` : `${(horas / 24).toFixed(1)} dias`}
              {campanha.plataforma ? ` · ${campanha.plataforma}` : ''}
            </p>
            {campanha.nota && (
              <p className="font-corpo font-light text-xs text-pergaminho/40 max-w-[70ch] mt-1">
                {campanha.nota}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <EditarCampanha
              campanha={{
                id: campanha.id,
                nome: campanha.nome,
                plataforma: campanha.plataforma ?? '',
                investido: (campanha.investido_centavos / 100).toFixed(2),
                inicio: deUtcParaLocal(campanha.inicio),
                fim: campanha.fim ? deUtcParaLocal(campanha.fim) : '',
                nota: campanha.nota ?? '',
              }}
            />
            <Link
              href={`/painel/central?de=${encodeURIComponent(deUtcParaLocal(janela.de))}&ate=${encodeURIComponent(deUtcParaLocal(janela.ate))}`}
              className="font-corpo text-[11px] text-pergaminho/45 hover:text-vela underline underline-offset-4 transition"
            >
              abrir esta janela na Central
            </Link>
          </div>
        </header>

        {/*
          Zero aqui quase nunca quer dizer "ninguém veio" — quer dizer "veio
          e chegou sem marcação".

          Esta faixa existe porque a mudança para atribuição real tem um efeito
          colateral honesto e assustador: campanha cujo link nunca carregou os
          UTMs nem o ?c= passou a mostrar zero, e antes mostrava o movimento
          inteiro do site naquela janela. Sem esta explicação, alguém abre a
          tela, vê zero e conclui que o painel quebrou — quando o que quebrou
          foi o link do anúncio, semanas atrás.
        */}
        {r.visitantes === 0 && (
          <section
            className="w-full rounded-xl border px-5 py-4 flex flex-col gap-2"
            style={{ borderColor: 'rgba(250,204,21,0.4)' }}
          >
            <span className="font-corpo text-sm" style={{ color: '#FACC15' }}>
              Nenhum acesso marcado com esta campanha
            </span>
            <p className="font-corpo font-light text-[11.5px] leading-relaxed text-pergaminho/50 max-w-[78ch]">
              O relatório conta só quem chegou carregando a identificação desta
              campanha. Quem entrou sem marcação nenhuma existe e está contado —
              só que na Central, como tráfego direto, porque não há como saber
              de onde veio.
              {campanha.utm_campanha
                ? ' Esta campanha veio do anúncio, então isto costuma significar que ele ainda não entregou no período escolhido.'
                : ' Para o tráfego cair aqui, o anúncio precisa usar o link com as macros de UTM (está no topo da lista de campanhas), ou o link curto desta campanha.'}
            </p>
          </section>
        )}

        {/* ── o veredicto ── */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Cartao rotulo="Investido" valor={brl(investido)}
            nota={campanha.alcance_estimado ? `alcance previsto ${campanha.alcance_estimado}` : undefined} />
          <Cartao rotulo="Receita bruta" valor={brl(receitaTotal)}
            nota={investido > 0 ? `ROAS ${roas.toFixed(2)}×` : undefined} cor={OURO} />
          <Cartao rotulo="Lucro" valor={brl(lucro)}
            nota="receita − taxa − IA − anúncio"
            cor={lucro > 0 ? VERDE : lucro < 0 ? VERMELHO : undefined} />
          <Cartao rotulo="Custo por pessoa"
            valor={custoPorPessoa > 0 ? brl(custoPorPessoa) : '—'} />
          <Cartao rotulo="Custo por e-mail"
            valor={custoPorEmail > 0 ? brl(custoPorEmail) : '—'} cor={VIOLETA} />
          <Cartao rotulo="Custo por venda"
            valor={custoPorVenda > 0 ? brl(custoPorVenda) : '—'} />
        </div>

        {/*
          De que a receita é feita.

          Sem esta linha, "Receita bruta" seria um número que mistura o que
          acontece uma vez com o que se repete — e quem lê não teria como
          saber qual das duas está sustentando o resultado. São decisões
          diferentes: venda avulsa se escala comprando mais mídia; assinatura
          se escala segurando quem já entrou.

          Só aparece quando há assinatura. Aqui esconder é certo: numa
          campanha que nunca vendeu plano, esta linha seria três zeros
          ocupando o lugar do que importa.
        */}
        {(r.assinaturasNovas > 0 || r.renovacoes > 0) && (
          <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Cartao rotulo="Vendas avulsas" valor={String(r.vendas)}
              nota={brl(r.brutoCentavos)} />
            <Cartao rotulo="Assinaturas novas" valor={String(r.assinaturasNovas)}
              nota="primeira cobrança paga" cor={VIOLETA} />
            <Cartao rotulo="Renovações" valor={String(r.renovacoes)}
              nota="meses seguintes desta base" cor={VIOLETA} />
            <Cartao rotulo="Receita de assinatura"
              valor={brl(r.receitaRecorrenteCentavos)}
              nota="dentro da receita bruta acima" cor={VIOLETA} />
          </div>
        )}

        {/* ── o que aconteceu ── */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <Cartao rotulo="Visitantes" valor={String(r.visitantes)} />
          <Cartao rotulo="Visitas" valor={String(r.visitas)} />
          <Cartao rotulo="Voltaram" valor={String(r.visitantesQueVoltaram)}
            nota="mais de uma visita" />
          <Cartao rotulo="Responderam" valor={String(r.responderamAlgo)} />
          <Cartao rotulo="Largaram" valor={String(r.abandonaramNoMeio)} cor={VERMELHO} />
          <Cartao rotulo="Terminaram" valor={String(r.terminaram)} />
          <Cartao rotulo="Conversão" valor={`${conversao.toFixed(1)}%`} cor={OURO} />
        </div>

        {/* ── gráficos ── */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/*
            As peças vêm ANTES dos gráficos agregados de propósito: a decisão
            que essa tela existe para apoiar é "qual vídeo pausa", e ela mora
            aqui. O agregado responde "como foi a campanha", que é a pergunta
            do dia seguinte, não a da hora.
          */}
          <Bloco
            titulo="Os vídeos desta campanha"
            nota={
              campanha.utm_campanha
                ? 'Esta campanha nasceu sozinha do link do anúncio, e os criativos aparecem aqui pelo ID que a Meta manda — pode renomear no lápis, o vínculo não se perde. Os links abaixo são OPCIONAIS: servem para link de bio, indicação e teste interno. O anúncio não precisa deles.'
                : 'Os links abaixo são OPCIONAIS. Anúncio no gerenciador não precisa de nenhum deles: basta o link normal com as macros de UTM, e a campanha e o criativo aparecem aqui sozinhos. Estes servem para o que a Meta não preenche — link de bio, indicação e teste interno.'
            }
            largo
          >
            <Pecas
              campanhaId={campanha.id}
              linhas={desempenhoPorPeca(campanha.id)}
              investidoCentavos={campanha.investido_centavos}
            />
          </Bloco>

          <Bloco titulo="Movimento durante a campanha"
            nota={`Linha = visitantes. Barras = vendas. Agrupado ${gran.rotulo}.`} largo>
            <SerieDoPeriodo serie={r.porHora} rotuloGranularidade={gran.rotulo} />
          </Bloco>

          <Bloco titulo="Onde as pessoas somem">
            <FunilDoPeriodo
              degraus={[
                { rotulo: 'Chegaram', pessoas: r.visitantes },
                { rotulo: 'Abriram o ritual', pessoas: r.iniciaramRitual },
                { rotulo: 'Responderam algo', pessoas: r.responderamAlgo },
                { rotulo: 'Viram a oferta', pessoas: r.terminaram },
                { rotulo: 'Escolheram um plano', pessoas: r.escolheramRevelacao + r.escolheramCompleta },
                { rotulo: 'Abriram o checkout', pessoas: r.abriramCheckout },
                { rotulo: 'Apertaram pagar', pessoas: r.tentaramPagar },
                { rotulo: 'Pagaram', pessoas: vendasTotais },
              ]}
            />
          </Bloco>

          <Bloco titulo="De onde vieram">
            <BarrasRotuladas
              linhas={r.porOrigem.map((o) => ({
                rotulo: NOME_DA_ORIGEM[o.origem] ?? o.origem,
                valor: o.pessoas,
                secundario: `${o.vendas} venda${o.vendas === 1 ? '' : 's'}`,
              }))}
            />
          </Bloco>


          <Bloco titulo="O que aconteceu no pagamento"
            nota="Método realmente tentado — inclusive nas tentativas que falharam. Antes só sabíamos o método de quem conseguiu pagar.">
            {r.porMetodo.length === 0 && r.recusas.length === 0 ? (
              <Vazio />
            ) : (
              <div className="flex flex-col gap-3">
                <BarrasRotuladas
                  linhas={r.porMetodo.map((m) => ({
                    rotulo: NOME_DO_METODO[m.metodo] ?? m.metodo,
                    valor: m.tentativas,
                    secundario: `${m.aprovadas} aprovada${m.aprovadas === 1 ? '' : 's'}`,
                  }))}
                />
                {r.recusas.length > 0 && (
                  <div className="flex flex-col gap-1 pt-2 border-t"
                    style={{ borderColor: 'var(--admin-borda)' }}>
                    <span className="font-corpo text-[11px] text-pergaminho/45">
                      Por que recusou
                    </span>
                    {r.recusas.map((x) => (
                      <div key={x.motivo} className="flex justify-between gap-3">
                        <span className="font-corpo text-[11px]" style={{ color: VERMELHO }}>
                          {MOTIVO_DA_RECUSA[x.motivo] ?? x.motivo}
                        </span>
                        <span className="font-corpo text-[11px] tabular-nums text-pergaminho/50">
                          {x.n}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Bloco>
          <Bloco titulo="Até onde foram no ritual" largo>
            <CurvaDoRitual curva={r.curvaDasCenas} total={TOTAL_DE_ITENS} />
          </Bloco>
        </div>

        {/* ── dinheiro aberto ── */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <Cartao rotulo="Bruto cobrado" valor={brl(r.brutoCentavos)} />
          <Cartao rotulo="Taxa do MP" valor={brl(r.taxaCentavos)} cor={VERMELHO} />
          <Cartao rotulo="Custo de IA" valor={brl(r.custoIaCentavos)} cor={VERMELHO} />
          <Cartao rotulo="Anúncio" valor={brl(investido)} cor={VERMELHO} />
          <Cartao rotulo="Sobrou" valor={brl(lucro)}
            cor={lucro > 0 ? VERDE : lucro < 0 ? VERMELHO : undefined} />
        </div>

        {/* ── as pessoas ── */}
        <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-corpo font-medium text-sm text-pergaminho/85">
              Quem entrou nesta janela ({r.pessoas.length})
            </h2>
            <p className="font-corpo font-light text-[11px] text-pergaminho/40 max-w-[80ch] leading-snug">
              Identidade por cookie anônimo, não por IP. Use os recortes para
              achar quem voltou, quem largou no meio e quem deixou e-mail sem
              comprar — esses três grupos são o que sobra de aproveitável de uma
              campanha que não vendeu.
            </p>
          </div>
          <TabelaDePessoas pessoas={r.pessoas} />
      </section>
    </div>
  );
}
