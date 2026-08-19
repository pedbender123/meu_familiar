import Link from 'next/link';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { direitosEfetivos } from '@/nucleo/acesso';
import { guiasDaConta, type GuiaSemanal } from '@/modulos/oraculo/guia';

export const dynamic = 'force-dynamic';

/**
 * Os guias da semana, guardados.
 *
 * ── Por que existe, se o guia vai por e-mail ──────────────────────────────
 *
 * Porque e-mail se perde, e o que a pessoa paga não pode morar só na caixa de
 * entrada dela. O direito se chama `guiaPorEmail` e descreve o ALCANCE — o
 * pago vai atrás da pessoa — não o lugar onde a coisa vive.
 *
 * ── E por que ele aparece para quem ainda não tem ─────────────────────────
 *
 * Item de menu que some é oportunidade perdida (o mesmo raciocínio da casca
 * da plataforma). Quem não tem o direito vê o que o guia é e onde ele mora,
 * com o gancho para o plano — não uma página vazia nem um 404.
 */
function semanaEmPalavras(chave: string): string {
  const [ano, mes, dia] = chave.split('-').map(Number);
  const inicio = new Date(ano, mes - 1, dia);
  const fim = new Date(inicio.getTime() + 6 * 86_400_000);
  const f = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${f(inicio)} — ${f(fim)}`;
}

export default async function Guia() {
  const sessao = await sessaoAtual();
  if (!sessao) return null;

  const conta = buscarConta(sessao.email);
  if (!conta) return null;

  const direitos = direitosEfetivos(conta.id, sessao.email);
  const guias = guiasDaConta(conta.id);

  if (!direitos.guiaPorEmail && guias.length === 0) {
    return (
      <section className="w-full max-w-xl flex flex-col items-center gap-6 pt-8 text-center">
        <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[22ch]">
          O guia da sua semana ainda não chega até você.
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed max-w-[40ch]">
          Todo domingo, o seu familiar lê os sete dias que vêm no seu mapa e
          escreve o que fazer com cada um. Ele chega no seu e-mail e fica
          guardado aqui.
        </p>
        <Link
          href="/planos"
          className="font-corpo text-sm px-6 py-3 rounded-full border border-vela/50 text-vela hover:bg-vela/10 transition-colors"
        >
          Ver os planos
        </Link>
      </section>
    );
  }

  if (guias.length === 0) {
    return (
      <section className="w-full max-w-xl flex flex-col items-center gap-5 pt-8 text-center">
        <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[24ch]">
          O primeiro guia chega no próximo domingo.
        </h1>
        <p className="font-corpo font-light text-sm text-pergaminho/60 leading-relaxed max-w-[38ch]">
          Ele é escrito uma vez por semana, sobre os sete dias que vêm — não
          adianta apressar o céu.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-xl flex flex-col gap-10 pt-4">
      {guias.map((linha) => {
        const corpo = JSON.parse(linha.corpo_json) as GuiaSemanal;
        return (
          <article key={linha.id} className="flex flex-col gap-5">
            <header className="flex flex-col gap-1">
              <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
                {semanaEmPalavras(linha.semana)}
              </p>
              <p className="font-display italic text-xl text-pergaminho leading-snug text-balance">
                {corpo.abertura}
              </p>
            </header>

            <ul className="flex flex-col gap-4">
              {corpo.dias.map((d) => (
                <li key={d.data} className="flex flex-col gap-1">
                  <span className="font-corpo text-[0.62rem] tracking-[0.18em] uppercase text-vela/70">
                    {d.nome}
                  </span>
                  <p className="font-corpo font-light text-sm text-pergaminho/75 leading-relaxed">
                    {d.texto}
                  </p>
                </li>
              ))}
            </ul>

            <p className="font-corpo font-light text-sm text-pergaminho/80 leading-relaxed border-l-2 border-vela/40 pl-4">
              {corpo.destaque}
            </p>

            <p className="font-display italic text-base text-pergaminho/60 leading-relaxed">
              {corpo.fechamento}
            </p>
          </article>
        );
      })}
    </section>
  );
}
