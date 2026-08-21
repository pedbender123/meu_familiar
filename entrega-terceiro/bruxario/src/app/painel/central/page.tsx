import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { relatorioDoPeriodo } from '@/lib/campanhas';
import { online, ondeEstaoAgora } from '@/lib/analitica';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import {
  deUtcParaLocal,
  ehPreset,
  granularidade,
  resolverPeriodo,
} from '@/lib/periodo';
import { FiltroDePeriodo } from '@/components/painel/FiltroDePeriodo';
import { TabelaDePessoas } from '@/components/painel/TabelaDePessoas';
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

export const metadata = { title: 'Central', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NOME_DA_ORIGEM: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  bio: 'Link da bio',
  stories: 'Stories',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  amigo: 'Indicação',
  direto: 'Direto',
  outro: 'Outros',
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
 * A central. **O painel que responde "e agora?" com o tráfego correndo.**
 *
 * ── O que ela substituiu ──────────────────────────────────────────────────
 *
 * O dashboard antigo respondia "como foi o mês" em janelas de dias fechados.
 * Isso não serve para campanha de tráfego, que sobe às 19h40 e para às 23h15 —
 * daí o intervalo com hora e minuto, e o recorte por pessoa em vez de só
 * agregado. O antigo foi aposentado; esta é a porta de entrada do painel.
 *
 * ── A ordem das perguntas ─────────────────────────────────────────────────
 *
 * 1. Tem gente agora? (muda enquanto você olha, e decide se dá pra reiniciar)
 * 2. Quanto entrou e quanto sobrou? (bruto − taxa − IA)
 * 3. Onde as pessoas somem? (funil e curva do ritual)
 * 4. De onde vêm e quem são? (origens e a tabela pessoa a pessoa)
 */
export default async function Central({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; de?: string; ate?: string }>;
}) {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const params = await searchParams;
  const periodo = resolverPeriodo(params);
  const gran = granularidade(periodo);
  const r = relatorioDoPeriodo(periodo.de, periodo.ate, gran.minutos);

  const agora = online();
  const olhando = ondeEstaoAgora();

  const lucro = r.liquidoCentavos - r.custoIaCentavos;
  const conversao = r.visitantes > 0 ? (r.vendas / r.visitantes) * 100 : 0;
  const ticket = r.vendas > 0 ? Math.round(r.brutoCentavos / r.vendas) : 0;

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
          {/* O nome da área vem da barra do topo do shell; aqui só o período. */}
          <p className="font-corpo text-xs text-pergaminho/45">{periodo.rotulo}</p>

          <Suspense fallback={null}>
            <FiltroDePeriodo
              base="/painel/central"
              presetAtivo={ehPreset(params.p) ? params.p : 'hoje'}
              deAtual={deUtcParaLocal(periodo.de)}
              ateAtual={deUtcParaLocal(periodo.ate)}
            />
          </Suspense>
        </header>

        {/* ── agora ── */}
        <section className="w-full rounded-xl border px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2"
          style={{ borderColor: agora > 0 ? 'rgba(217,164,65,0.45)' : 'var(--admin-borda)' }}>
          <span className="font-corpo text-sm" style={{ color: agora > 0 ? OURO : 'color-mix(in srgb, var(--pergaminho) 60%, transparent)' }}>
            {agora > 0 ? `${agora} pessoa${agora > 1 ? 's' : ''} no site agora` : 'Ninguém no site agora'}
          </span>
          {olhando.length > 0 && (
            <span className="font-corpo text-xs text-pergaminho/45">
              {olhando.map((o) => `${o.caminho} (${o.n})`).join(' · ')}
            </span>
          )}
          {agora > 0 && (
            <span className="font-corpo text-[11px] text-pergaminho/35 ml-auto">
              Não reinicie o servidor com gente no meio do ritual.
            </span>
          )}
        </section>

        {/* ── os números ── */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Cartao rotulo="Visitantes" valor={String(r.visitantes)}
            nota={`${r.visitas} visitas · ${r.visitantesQueVoltaram} voltaram`} />
          <Cartao rotulo="Responderam" valor={String(r.responderamAlgo)}
            nota={`${r.iniciaramRitual} abriram o ritual`} />
          <Cartao rotulo="Terminaram" valor={String(r.terminaram)}
            nota={`${r.abandonaramNoMeio} largaram no meio`} />
          <Cartao rotulo="E-mails" valor={String(r.emailsCapturados)}
            nota={`${r.emailsSoRascunho} sem comprar`} cor={VIOLETA} />
          <Cartao rotulo="Vendas" valor={String(r.vendas)}
            nota={`${conversao.toFixed(1)}% dos visitantes`} cor={OURO} />
          <Cartao rotulo="Lucro" valor={brl(lucro)}
            nota={ticket > 0 ? `ticket ${brl(ticket)}` : 'bruto − taxa − IA'}
            cor={lucro > 0 ? VERDE : lucro < 0 ? VERMELHO : undefined} />
        </div>

        {/* ── o dinheiro, aberto ── */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Cartao rotulo="Bruto" valor={brl(r.brutoCentavos)} nota="o que foi cobrado" />
          <Cartao rotulo="Taxa Mercado Pago" valor={brl(r.taxaCentavos)}
            nota="lida da resposta do MP" cor={VERMELHO} />
          <Cartao rotulo="Custo de IA" valor={brl(r.custoIaCentavos)}
            nota="estimado por tokens" cor={VERMELHO} />
          <Cartao rotulo="Líquido recebido" valor={brl(r.liquidoCentavos)}
            nota="antes do custo de IA" />
        </div>

        {/* ── gráficos ── */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Bloco titulo="Movimento no período" nota={`Linha = visitantes. Barras = vendas. Agrupado ${gran.rotulo}.`} largo>
            <SerieDoPeriodo serie={r.porHora} rotuloGranularidade={gran.rotulo} />
          </Bloco>

          <Bloco titulo="Onde as pessoas somem"
            nota="A queda entre dois degraus vizinhos aponta o problema — não o valor absoluto.">
            <FunilDoPeriodo
              degraus={[
                { rotulo: 'Chegaram', pessoas: r.visitantes },
                { rotulo: 'Abriram o ritual', pessoas: r.iniciaramRitual },
                { rotulo: 'Responderam algo', pessoas: r.responderamAlgo },
                { rotulo: 'Viram a oferta', pessoas: r.terminaram },
                { rotulo: 'Escolheram um plano', pessoas: r.escolheramRevelacao + r.escolheramCompleta },
                { rotulo: 'Abriram o checkout', pessoas: r.abriramCheckout },
                { rotulo: 'Apertaram pagar', pessoas: r.tentaramPagar },
                { rotulo: 'Pagaram', pessoas: r.vendas },
              ]}
            />
          </Bloco>

          <Bloco titulo="De onde vieram" nota="Ordenado por gente, com as vendas ao lado.">
            <BarrasRotuladas
              linhas={r.porOrigem.map((o) => ({
                rotulo: NOME_DA_ORIGEM[o.origem] ?? o.origem,
                valor: o.pessoas,
                secundario: `${o.vendas} venda${o.vendas === 1 ? '' : 's'}`,
              }))}
            />
          </Bloco>

          <Bloco titulo="Até onde foram no ritual"
            nota="Cada barra é uma cena. Procure o degrau, não a altura." largo>
            <CurvaDoRitual curva={r.curvaDasCenas} total={TOTAL_DE_ITENS} />
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
          <Bloco titulo="Aparelho">
            <BarrasRotuladas
              linhas={r.porDispositivo.map((d) => ({
                rotulo: d.dispositivo ?? 'desconhecido',
                valor: d.pessoas,
              }))}
            />
          </Bloco>
        </div>

        {/* ── as pessoas ── */}
      <section className="flex flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="font-corpo font-medium text-sm text-pergaminho/85">
              Quem passou por aqui ({r.pessoas.length})
            </h2>
            <p className="font-corpo font-light text-[11px] text-pergaminho/40 max-w-[80ch] leading-snug">
              Uma linha por visitante anônimo (id de cookie primeiro-parte, não
              IP). Ordenado por quem foi mais longe no ritual. Nome, e-mail e
              nascimento só aparecem em quem os entregou.
            </p>
          </div>
          <TabelaDePessoas pessoas={r.pessoas} />
      </section>
    </div>
  );
}

