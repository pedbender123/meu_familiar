import Link from 'next/link';
import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { listarCampanhas, janelaDaCampanha, relatorioDoPeriodo } from '@/lib/campanhas';
import { dataHoraBr } from '@/lib/periodo';
import { FormularioDeCampanha } from '@/components/painel/FormularioDeCampanha';
import { LinkDoAnuncio } from '@/components/painel/LinkDoAnuncio';
import { brl, OURO, VERDE, VERMELHO } from '@/components/painel/GraficosPeriodo';

export const metadata = { title: 'Campanhas', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * A lista de campanhas, cada uma com o resultado já calculado.
 *
 * ── Por que o cálculo roda aqui e não só no detalhe ───────────────────────
 *
 * Porque a pergunta que importa é comparativa: "qual anúncio pagou?". Ver
 * gasto e retorno lado a lado responde isso de relance; abrir uma por uma
 * para descobrir obrigaria a guardar números de cabeça.
 *
 * O custo disso é uma consulta por campanha. Com dezenas de campanhas em
 * SQLite local, é irrelevante; se um dia forem centenas, este é o lugar para
 * cortar (resumo agregado na lista, detalhe só no clique).
 */
export default async function Campanhas() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const campanhas = listarCampanhas();
  const comResultado = campanhas.map((c) => {
    const j = janelaDaCampanha(c);
    const r = relatorioDoPeriodo(j.de, j.ate, 1440, c.id);
    /*
      Assinatura conta como venda desta campanha — mesma conta da tela de
      detalhe, e pelo mesmo motivo: deixá-la de fora faria a campanha que
      vende plano aparecer com uma fração do resultado que teve.
    */
    const vendas = r.vendas + r.assinaturasNovas + r.renovacoes;
    const liquido =
      r.liquidoCentavos + (r.receitaRecorrenteCentavos - r.taxaRecorrenteCentavos);
    const lucro = liquido - r.custoIaCentavos - c.investido_centavos;
    return { campanha: c, r, vendas, lucro, noAr: !c.fim };
  });

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">

        <p className="font-corpo font-light text-xs text-pergaminho/45 leading-relaxed max-w-[62ch]">
          Campanha nova aparece aqui sozinha assim que o primeiro clique do
          anúncio chegar — não precisa cadastrar nada antes. Cadastrar à mão
          serve para o que a Meta não preenche: link de bio, indicação e teste
          interno.
          <br />
          <span className="opacity-70">
            Os números de cada campanha contam só quem chegou marcado com ela —
            pelas macros de UTM do anúncio ou pelo link curto. Quem entrou sem
            marcação aparece na Central, como tráfego direto. Campanha zerada
            quase sempre quer dizer link sem marcação, não ausência de gente.
          </span>
        </p>
        <FormularioDeCampanha />
      </div>

      <LinkDoAnuncio base={process.env.BASE_URL || 'https://bruxario.com.br'} />

        {comResultado.length === 0 && (
          <div className="w-full rounded-xl border px-6 py-10 text-center superficie" style={{ borderColor: 'var(--admin-borda)' }}>
            <p className="font-corpo text-sm text-pergaminho/50">
              Nenhuma campanha ainda.
            </p>
            <p className="font-corpo text-xs text-pergaminho/35 mt-1">
              Crie uma quando subir o anúncio, com o horário em que ele começou.
            </p>
          </div>
        )}

        <div className="w-full flex flex-col gap-3">
          {comResultado.map(({ campanha: c, r, vendas, lucro, noAr }) => {
            const custoPorPessoa =
              r.visitantes > 0 ? Math.round(c.investido_centavos / r.visitantes) : 0;
            const custoPorVenda =
              vendas > 0 ? Math.round(c.investido_centavos / vendas) : 0;
            const assinaturas = r.assinaturasNovas + r.renovacoes;
            return (
              <Link key={c.id} href={`/painel/campanhas/${c.id}`}
                className="rounded-xl border hover:border-vela/40 superficie px-5 py-4 flex flex-col gap-3 transition">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="font-corpo font-medium text-sm text-pergaminho">
                      {c.nome}
                    </span>
                    {noAr && (
                      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border"
                        style={{ color: OURO, borderColor: 'rgba(217,164,65,0.4)' }}>
                        no ar
                      </span>
                    )}
                    {/*
                      Distingue a campanha que nasceu do anúncio da que alguém
                      cadastrou. Não é enfeite: as duas se leem diferente. A
                      de UTM tem atribuição de verdade — cada visita chegou
                      carregando o ID dela. A cadastrada à mão é uma janela de
                      tempo, e o alcance dela inclui quem passou pelo site sem
                      ter vindo do anúncio.
                    */}
                    {c.utm_campanha && (
                      <span
                        className="font-corpo text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border"
                        style={{ color: VERDE, borderColor: 'rgba(74,222,128,0.35)' }}
                        title={`Nasceu do anúncio. ID da Meta: ${c.utm_campanha}`}
                      >
                        do anúncio
                      </span>
                    )}
                    {c.plataforma && (
                      <span className="font-corpo text-[11px] text-pergaminho/40">
                        {c.plataforma}
                      </span>
                    )}
                  </div>
                  <span className="font-corpo text-[11px] text-pergaminho/40">
                    {dataHoraBr(c.inicio)} → {c.fim ? dataHoraBr(c.fim) : 'agora'}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-2">
                  <Numero rotulo="investido" valor={brl(c.investido_centavos)} />
                  <Numero rotulo="pessoas" valor={String(r.visitantes)} />
                  <Numero rotulo="terminaram" valor={String(r.terminaram)} />
                  <Numero rotulo="vendas" valor={String(vendas)} cor={OURO} />
                  <Numero rotulo="por pessoa"
                    valor={custoPorPessoa > 0 ? brl(custoPorPessoa) : '—'} />
                  <Numero rotulo="lucro" valor={brl(lucro)}
                    cor={lucro > 0 ? VERDE : lucro < 0 ? VERMELHO : undefined} />
                </div>

                {vendas > 0 && custoPorVenda > 0 && (
                  <p className="font-corpo text-[11px] text-pergaminho/40">
                    Custo por venda: {brl(custoPorVenda)} · e-mails capturados:{' '}
                    {r.emailsCapturados}
                    {/*
                      Quantas das vendas são assinatura. Sem isto, "12 vendas"
                      numa campanha que vendeu 3 planos e 9 PDFs lê igual a uma
                      que vendeu 12 PDFs — e as duas se escalam diferente.
                    */}
                    {assinaturas > 0 &&
                      ` · ${assinaturas} de assinatura (${brl(r.receitaRecorrenteCentavos)})`}
                  </p>
                )}
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function Numero({
  rotulo, valor, cor,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-corpo text-[10px] uppercase tracking-[0.12em] text-pergaminho/35">
        {rotulo}
      </span>
      <span className="font-corpo text-sm tabular-nums" style={{ color: cor ?? 'var(--pergaminho)' }}>
        {valor}
      </span>
    </div>
  );
}
