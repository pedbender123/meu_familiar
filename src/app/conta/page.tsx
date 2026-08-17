import Link from 'next/link';
import db from '@/lib/db';
import { sessaoAtual } from '@/lib/sessao-servidor';
import { buscarConta } from '@/lib/autenticacao';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import type { Signo } from '@/lib/astro';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { perfilAstralDaConta, herdarNascimentoDosPedidos } from '@/nucleo/perfil-astral';
import { direitosEfetivos } from '@/nucleo/acesso';
import { SEM_DIREITOS } from '@/nucleo/direitos';
import { ceuDoDia } from '@/nucleo/ceu-do-dia';
import { CompletarNascimento } from '@/plataforma/CompletarNascimento';
import { RetratoDaPersonalidade } from '@/plataforma/RetratoDaPersonalidade';

interface Linha {
  id: string;
  familiar: string;
  leitura_json: string | null;
  perfil_json: string | null;
  signo_lua: string | null;
}

/**
 * O início: o painel de quem já está dentro.
 *
 * Três coisas, nesta ordem — quem você é, quem está com você, e como está o
 * céu hoje. As duas primeiras não mudam e servem de âncora ("este lugar é
 * meu"); a terceira muda todo dia e é o único motivo real de voltar amanhã.
 *
 * Deliberadamente **não** vira um painel de métricas. O grimório não tem
 * KPI — o que ele tem é um retrato, um bicho e o céu.
 */
export default async function InicioDaConta() {
  const sessao = await sessaoAtual();

  const ultima = db
    .prepare(
      `SELECT id, familiar, leitura_json, perfil_json, signo_lua FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(sessao!.email) as Linha | undefined;

  const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
  const leitura = ultima?.leitura_json ? JSON.parse(ultima.leitura_json) : null;
  const perfil = ultima?.perfil_json ? JSON.parse(ultima.perfil_json) : null;

  /**
   * Aproveita data e hora que a pessoa já deu no ritual antes de perguntar
   * qualquer coisa — pedir de novo o que ela já digitou é o jeito mais rápido
   * de fazer alguém desistir do formulário.
   */
  const conta = buscarConta(sessao!.email);
  if (conta) herdarNascimentoDosPedidos(conta.id, sessao!.email);
  const perfilAstral = conta ? perfilAstralDaConta(conta.id) : null;
  const direitos = conta ? direitosEfetivos(conta.id, sessao!.email) : SEM_DIREITOS;

  const agora = new Date();
  const ceu = ceuDoDia(agora, (ultima?.signo_lua as Signo) ?? null);
  // `pt-BR` no servidor: a data é a mesma pra todo mundo (o produto é
  // brasileiro), e formatar no cliente causaria o texto piscar na hidratação.
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(agora);

  if (!familiar) {
    return (
      <section className="w-full max-w-xl flex flex-col items-center gap-7 pt-8 sm:pt-16 text-center">
        <h1 className="font-display italic text-3xl text-pergaminho text-balance max-w-[24ch]">
          Seu Bruxário está aberto, mas ainda vazio.
        </h1>
        <Link
          href="/ritual"
          className="bg-vela text-tinta font-corpo font-medium px-7 py-3.5 rounded-full hover:brightness-110 transition"
        >
          Começar o ritual
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-2xl flex flex-col gap-10 pt-6 sm:pt-10">
      {/* ── O familiar: a âncora ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <SigiloFamiliar sigilo={familiar.sigilo} tamanho={110} variante="quarto" />

        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="font-display italic text-3xl text-pergaminho text-balance leading-tight">
            {familiar.nome}
          </h1>
          {leitura?.nome_secreto && (
            <p className="font-ritual text-2xl text-vela leading-none">
              {leitura.nome_secreto}
            </p>
          )}
          <p className="font-corpo font-light text-sm text-pergaminho/50 pt-1">
            está com você
          </p>
        </div>
      </div>

      {perfilAstral && !perfilAstral.completo && (
        <CompletarNascimento
          faltando={perfilAstral.faltando}
          dataInicial={perfilAstral.dados.data}
          horaInicial={perfilAstral.dados.hora}
        />
      )}

      {/* ── O céu de hoje: o motivo de voltar amanhã ──────────────────── */}
      <div className="flex flex-col gap-3 p-5 rounded-2xl border border-pergaminho/10 bg-pergaminho/[0.03]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-corpo text-[0.6rem] tracking-[0.24em] uppercase text-pergaminho/35">
            Hoje <span className="text-pergaminho/25">· {hoje}</span>
          </p>
          <p className="font-corpo text-xs text-pergaminho/45">
            {ceu.faseNome} em {ceu.luaEm}
          </p>
        </div>

        <p className="font-display italic text-lg leading-relaxed text-pergaminho/80">
          {ceu.clima}
        </p>

        {ceu.luaEmCasa && (
          <p className="font-corpo text-xs text-vela/90 leading-relaxed">
            A Lua voltou para o signo onde ela estava quando você nasceu — isso
            acontece uma vez por mês, e costuma ser o dia em que tudo pesa mais.
          </p>
        )}

        {direitos.alcanceCalendario !== 'nenhum' && (
          <Link
            href="/conta/calendario"
            className="font-corpo text-sm text-vela hover:brightness-125 transition self-start"
          >
            Ver o calendário →
          </Link>
        )}
      </div>

      {/* ── O retrato ─────────────────────────────────────────────────── */}
      {perfil?.eixos && (
        <RetratoDaPersonalidade
          eixos={perfil.eixos}
          completo={direitos.perfilCompleto}
        />
      )}

      {leitura?.sussurro_final && (
        <p className="font-display italic text-lg leading-relaxed text-pergaminho/60 text-center max-w-[34ch] mx-auto">
          &ldquo;{leitura.sussurro_final}&rdquo;
        </p>
      )}
    </section>
  );
}
