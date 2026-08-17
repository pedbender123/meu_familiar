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
import { mapaDaConta } from '@/modulos/calendario/calendario';
import {
  pontuarDia,
  destaqueDo,
  classificar,
  ehDiaDeOuro,
  ehDiaFechado,
} from '@/modulos/calendario/pontuacao';
import { fraseDoDia } from '@/modulos/calendario/frases';
import { CompletarNascimento } from '@/plataforma/CompletarNascimento';
import { RetratoDaPersonalidade } from '@/plataforma/RetratoDaPersonalidade';
import { CeuDeHoje } from '@/plataforma/CeuDeHoje';

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

  /**
   * O layout já barra quem não tem sessão, mas em Next 16 layout e página
   * renderizam **em paralelo** — o `redirect()` de lá acontece, e mesmo assim
   * o corpo daqui executa uma vez com `sessao` nula. Sem esta saída, todo
   * acesso deslogado lança `Cannot read properties of null` no servidor:
   * a pessoa é redirecionada do mesmo jeito, mas o log enche de erro e um
   * problema de verdade passa despercebido no meio.
   */
  if (!sessao) return null;

  const ultima = db
    .prepare(
      `SELECT id, familiar, leitura_json, perfil_json, signo_lua FROM pedidos
       WHERE lower(email) = ? AND status = 'entregue'
       ORDER BY criado_em DESC LIMIT 1`
    )
    .get(sessao.email) as Linha | undefined;

  const familiar = ultima ? FAMILIARES[ultima.familiar as FamiliarId] : null;
  const leitura = ultima?.leitura_json ? JSON.parse(ultima.leitura_json) : null;
  const perfil = ultima?.perfil_json ? JSON.parse(ultima.perfil_json) : null;

  /**
   * Aproveita data e hora que a pessoa já deu no ritual antes de perguntar
   * qualquer coisa — pedir de novo o que ela já digitou é o jeito mais rápido
   * de fazer alguém desistir do formulário.
   */
  const conta = buscarConta(sessao.email);
  if (conta) herdarNascimentoDosPedidos(conta.id, sessao.email);
  const perfilAstral = conta ? perfilAstralDaConta(conta.id) : null;
  const direitos = conta ? direitosEfetivos(conta.id, sessao.email) : SEM_DIREITOS;

  const agora = new Date();
  const ceu = ceuDoDia(agora, (ultima?.signo_lua as Signo) ?? null);
  // `pt-BR` no servidor: a data é a mesma pra todo mundo (o produto é
  // brasileiro), e formatar no cliente causaria o texto piscar na hidratação.
  const hoje = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(agora);

  /**
   * A leitura de HOJE — um dia só, não o mês.
   *
   * São 7 leituras de efeméride: barato o bastante para rodar na inicial de
   * quem tem o direito, e não roda para quem não tem. Reaproveita exatamente
   * o mesmo cálculo do Calendário, então as duas telas nunca discordam sobre
   * o mesmo dia.
   */
  const natal =
    perfilAstral && direitos.alcanceCalendario !== 'nenhum'
      ? mapaDaConta(perfilAstral.dados)
      : null;

  const pontuacaoDeHoje = natal ? pontuarDia(natal, agora) : null;
  const chaveDeHoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const ouroHoje = pontuacaoDeHoje ? ehDiaDeOuro(pontuacaoDeHoje) : false;
  const fraseDeHoje = pontuacaoDeHoje
    ? fraseDoDia(
        chaveDeHoje,
        destaqueDo(pontuacaoDeHoje).dominio,
        classificar(destaqueDo(pontuacaoDeHoje).nota),
        ouroHoje,
        ehDiaFechado(pontuacaoDeHoje)
      )
    : null;

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
      <CeuDeHoje
        ceu={ceu}
        data={hoje}
        pontuacao={pontuacaoDeHoje}
        frase={fraseDeHoje}
        ouro={ouroHoje}
        temCalendario={direitos.alcanceCalendario !== 'nenhum'}
      />

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
