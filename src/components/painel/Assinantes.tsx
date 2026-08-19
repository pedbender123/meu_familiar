import type { ResumoDeAssinantes, LinhaDeAssinante } from '@/nucleo/assinantes';

function reais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dia(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

/**
 * Os números de assinatura, do mais decisivo para o mais detalhado.
 *
 * A ordem da tela é a ordem em que as perguntas aparecem na cabeça de quem
 * abre: quanto entra por mês, de quanta gente, e quem está prestes a sair.
 * A lista completa fica por último — ela é para investigar um caso, não para
 * ser lida.
 */
export function PainelDeAssinantes({
  resumo,
  lista,
}: {
  resumo: ResumoDeAssinantes;
  lista: LinhaDeAssinante[];
}) {
  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Cartao
          rotulo="Receita por mês"
          valor={reais(resumo.mrrCentavos)}
          nota="o que se repete, com anual dividido por 12"
          destaque
        />
        <Cartao
          rotulo="Pagantes"
          valor={String(resumo.pagantes)}
          nota={`${resumo.gratuitos} no gratuito`}
        />
        <Cartao
          rotulo="Média por pagante"
          valor={reais(resumo.ticketMedioCentavos)}
          nota="diz se a escada puxa pra cima"
        />
        <Cartao
          rotulo="Churn do mês"
          valor={resumo.churnMes === null ? '—' : `${(resumo.churnMes * 100).toFixed(1)}%`}
          nota={
            resumo.churnMes === null
              ? 'ninguém ativo no início do mês'
              : `${resumo.novosNoMes} novos · ${resumo.perdidosNoMes} perdidos`
          }
        />
      </div>

      <Bloco titulo="Por plano">
        {resumo.porPlano.length === 0 ? (
          <Vazio>Nenhuma assinatura ativa ainda.</Vazio>
        ) : (
          <ul className="flex flex-col gap-1">
            {resumo.porPlano.map((p) => (
              <li
                key={p.plano_id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                style={{ background: 'var(--admin-fundo-suave, transparent)' }}
              >
                <span className="font-corpo text-sm text-pergaminho">
                  {p.plano_nome}
                  <span className="text-pergaminho/40"> · {p.quantos}</span>
                </span>
                <span className="font-corpo text-sm text-pergaminho/70 tabular-nums">
                  {p.mrrCentavos > 0 ? `${reais(p.mrrCentavos)}/mês` : 'grátis'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco
        titulo="Vence nos próximos 7 dias"
        nota="quem paga no Pix não renova sozinho — é este aviso que faz a renovação acontecer"
      >
        {resumo.vencendo.length === 0 ? (
          <Vazio>Ninguém vencendo esta semana.</Vazio>
        ) : (
          <ul className="flex flex-col gap-1">
            {resumo.vencendo.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border"
                style={{ borderColor: 'var(--admin-borda)' }}
              >
                <span className="font-corpo text-sm text-pergaminho truncate">
                  {a.email}
                  <span className="text-pergaminho/40"> · {a.plano_nome}</span>
                </span>
                <span className="font-corpo text-xs text-vela shrink-0 tabular-nums">
                  {a.diasRestantes === 0 ? 'hoje' : `em ${a.diasRestantes}d`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo={`Todos os ativos (${lista.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-corpo">
            <thead>
              <tr className="text-left text-pergaminho/40 text-xs">
                <th className="py-2 pr-3 font-normal">Quem</th>
                <th className="py-2 pr-3 font-normal">Plano</th>
                <th className="py-2 pr-3 font-normal">Desde</th>
                <th className="py-2 pr-3 font-normal">Até</th>
                <th className="py-2 pr-3 font-normal text-right">Por mês</th>
                <th className="py-2 font-normal text-right">Já pagou</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr
                  key={a.id}
                  className="border-t"
                  style={{ borderColor: 'var(--admin-borda)' }}
                >
                  <td className="py-2 pr-3 text-pergaminho/85 max-w-[22ch] truncate">
                    {a.email}
                  </td>
                  <td className="py-2 pr-3 text-pergaminho/60">{a.plano_nome}</td>
                  <td className="py-2 pr-3 text-pergaminho/50 tabular-nums">
                    {dia(a.inicio)}
                  </td>
                  <td className="py-2 pr-3 text-pergaminho/50 tabular-nums">
                    {dia(a.fim)}
                  </td>
                  <td className="py-2 pr-3 text-pergaminho/70 text-right tabular-nums">
                    {a.porMesCentavos > 0 ? reais(a.porMesCentavos) : '—'}
                  </td>
                  <td className="py-2 text-pergaminho/70 text-right tabular-nums">
                    {a.pagoCentavos > 0 ? reais(a.pagoCentavos) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && <Vazio>Nenhuma assinatura ativa.</Vazio>}
        </div>
      </Bloco>
    </div>
  );
}

function Cartao({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-xl border"
      style={{
        borderColor: destaque ? 'rgba(217,164,65,0.4)' : 'var(--admin-borda)',
        background: destaque ? 'rgba(217,164,65,0.06)' : 'transparent',
      }}
    >
      <span className="font-corpo text-[0.62rem] tracking-[0.16em] uppercase text-pergaminho/40">
        {rotulo}
      </span>
      <span
        className={`font-display ${destaque ? 'text-vela text-2xl' : 'text-pergaminho text-xl'} tabular-nums`}
      >
        {valor}
      </span>
      {nota && (
        <span className="font-corpo text-[11px] text-pergaminho/35 leading-snug">
          {nota}
        </span>
      )}
    </div>
  );
}

function Bloco({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-display italic text-lg text-pergaminho">{titulo}</h2>
        {nota && (
          <p className="font-corpo text-[11px] text-pergaminho/35 leading-relaxed max-w-[64ch]">
            {nota}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-corpo text-sm text-pergaminho/30 px-3 py-5 text-center">
      {children}
    </p>
  );
}
