import { redirect } from 'next/navigation';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { contatosAbertos, contatosRecentes, comentariosPendentes } from '@/lib/db';
import { Bloco } from '@/components/painel/GraficosPeriodo';
import { dataHoraBr } from '@/lib/periodo';

export const metadata = { title: 'Contatos', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Quem escreveu e o que espera resposta.
 *
 * Este é o "encarregado" que a LGPD (art. 41) exige: um canal onde a pessoa
 * fala sobre os dados dela e recebe resposta. Por isso os abertos vêm
 * primeiro e em destaque — um contato de titular de dados esquecido numa
 * lista é o tipo de coisa que vira problema formal.
 */
export default async function Contatos() {
  const sessao = await sessaoAtual();
  if (!sessao || sessao.tipo !== 'admin') redirect('/painel/entrar');

  const abertos = contatosAbertos();
  const pendentes = comentariosPendentes();
  const recentes = contatosRecentes(20);

  const vazio = abertos.length === 0 && pendentes.length === 0;

  return (
    <div className="flex flex-col gap-4 max-w-5xl">
      {vazio && (
        <div className="rounded-xl border px-6 py-10 text-center superficie"
          style={{ borderColor: 'var(--admin-borda)' }}>
          <p className="font-corpo text-sm text-pergaminho/50">
            Nada esperando resposta.
          </p>
        </div>
      )}

      {abertos.length > 0 && (
        <Bloco titulo={`Contatos esperando resposta (${abertos.length})`}
          nota="Responda pelo e-mail. Marcar como resolvido ainda é manual no banco.">
          <ul className="flex flex-col gap-2">
            {abertos.map((c) => (
              <li key={c.id}
                className="rounded-lg border border-vela/25 bg-vela/[0.05] px-4 py-3 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-corpo text-sm text-pergaminho">
                    {c.nome}{' '}
                    <a href={`mailto:${c.email}`} className="text-vela underline underline-offset-2">
                      {c.email}
                    </a>
                  </span>
                  <span className="font-corpo text-[11px] text-pergaminho/45">
                    {c.assunto} · {dataHoraBr(c.criado_em)}
                  </span>
                </div>
                <p className="font-corpo font-light text-[13px] text-pergaminho/75 whitespace-pre-wrap">
                  {c.mensagem}
                </p>
                {c.pedido_id && (
                  <span className="font-corpo text-[11px] text-pergaminho/45">
                    pedido {c.pedido_id.slice(0, 8)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {pendentes.length > 0 && (
        <Bloco titulo={`Comentários esperando aprovação (${pendentes.length})`}
          nota="Nenhum aparece no mural antes de você ler. Aprovar ainda é manual: UPDATE comentarios SET aprovado=1 WHERE id='...'">
          <ul className="flex flex-col gap-2">
            {pendentes.map((c) => (
              <li key={c.id}
                className="rounded-lg border border-vela/25 bg-vela/[0.05] px-4 py-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-corpo text-sm text-pergaminho">{c.nome}</span>
                  <span className="font-corpo text-[11px] text-pergaminho/45">
                    {c.id.slice(0, 8)} · {dataHoraBr(c.criado_em)}
                  </span>
                </div>
                <p className="font-corpo font-light text-[13px] text-pergaminho/75">
                  &ldquo;{c.texto}&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {recentes.length > 0 && (
        <Bloco titulo="Histórico de contatos">
          <div className="w-full overflow-x-auto rounded-lg border"
            style={{ borderColor: 'var(--admin-borda)' }}>
            <table className="w-full border-collapse font-corpo text-[11px]">
              <thead>
                <tr className="text-pergaminho/40">
                  {['quem', 'assunto', 'estado', 'quando'].map((c) => (
                    <th key={c} scope="col" className="text-left font-medium px-2.5 py-2">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-pergaminho/75">
                {recentes.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: 'var(--admin-borda)' }}>
                    <td className="px-2.5 py-1.5">{c.email}</td>
                    <td className="px-2.5 py-1.5">{c.assunto}</td>
                    <td className="px-2.5 py-1.5">
                      {c.resolvido_em ? (
                        <span className="text-pergaminho/45">resolvido</span>
                      ) : (
                        <span className="text-vela">aberto</span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums text-pergaminho/45">
                      {dataHoraBr(c.criado_em)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloco>
      )}
    </div>
  );
}
