import Link from 'next/link';
import { FAMILIARES, type FamiliarId, type LuaId } from '@/lib/familiares';
import type { Leitura } from '@/lib/leitura';
import type { Signo } from '@/lib/astro';
import type { Pedido } from '@/lib/db';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { CartaFamiliar } from '@/components/CartaFamiliar';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { TextoEscrito, BlocoRevelado } from '@/components/TextoEscrito';
import { Constelacao } from '@/components/Constelacao';
import { BotaoCompartilhar } from '@/components/BotaoCompartilhar';
import { OfertaDaCompleta } from '@/components/OfertaDaCompleta';
import { podeMelhorar } from '@/nucleo/melhoria';
import { MarcarNoStory } from '@/components/MarcarNoStory';
import { marcacaoDoPedido } from '@/lib/marcacoes';
import { AvisoDeExpiracao } from '@/components/AvisoDeExpiracao';
import { produtoDe } from '@/lib/produtos';
import { RelatorioCompleto, type Perfil } from '@/components/RelatorioCompleto';
import { TocaAudio } from '@/components/TocaAudio';

/**
 * A revelação inteira — a mesma, em dois lugares.
 *
 * ── Por que isto virou um componente ──────────────────────────────────────
 *
 * Ela nasceu como página solta em `/revelacao/[id]`: um endereço público, com
 * prazo, que a pessoa recebia por e-mail e mostrava para as amigas. Isso
 * continua existindo, porque é o que circula — o link é o produto se
 * mostrando sozinho.
 *
 * O que mudou é o outro lado. Quem compra agora **entra na plataforma**, e a
 * revelação é a primeira coisa que ela vê lá dentro, ao lado do Oráculo, do
 * calendário e da estante. Manter duas cópias do mesmo grimório em dois
 * arquivos era garantir que um dia eles ficassem diferentes — e o dia em que
 * ficam diferentes é o dia em que a de dentro parece a versão pobre.
 *
 * ── O que muda entre os dois contextos ────────────────────────────────────
 *
 * Só a moldura. `publico` desenha o quarto inteiro (a vela, o rodapé legal, o
 * convite para quem chegou pelo link de outra pessoa); `app` não desenha nada
 * disso, porque a casca da conta já é o quarto — e repetir a vela dentro dela
 * seria duas fontes de luz na mesma sala.
 *
 * O conteúdo da folha é literalmente o mesmo objeto nos dois. É a regra da
 * estética levada a sério: o grimório não sabe em que cômodo está.
 */
export function CorpoDaRevelacao({
  pedido,
  leitura,
  ehADona,
  temSessaoDeConta,
  contexto,
}: {
  pedido: Pedido;
  leitura: Leitura;
  ehADona: boolean;
  /** Logada como cliente — o que habilita marcar no story e opinar. */
  temSessaoDeConta: boolean;
  contexto: 'publico' | 'app';
}) {
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];
  const produto = produtoDe(pedido.produto);
  const id = pedido.id;

  // Os gráficos só existem na Completa — é o que ela vende. Pedidos antigos
  // não têm perfil salvo, então a ausência também esconde a seção em vez de
  // quebrar a página.
  const perfil: Perfil | null =
    produto.graficos && pedido.perfil_json
      ? (JSON.parse(pedido.perfil_json) as Perfil)
      : null;

  return (
    <>
      {contexto === 'publico' && <Vela />}

      {pedido.expira_em && (
        <AvisoDeExpiracao pedidoId={id} expiraEm={pedido.expira_em} ehADona={ehADona} />
      )}

      <FolhaPergaminho>
        <SigiloFamiliar sigilo={familiar.sigilo} tamanho={200} />

        <span className="font-corpo text-[0.68rem] tracking-[0.24em] uppercase text-escrita-fraca">
          O familiar de
        </span>
        <p className="font-ritual text-5xl sm:text-6xl leading-none text-escrita text-center text-balance">
          {pedido.nome}
        </p>

        <h1 className="font-display italic font-semibold text-2xl sm:text-4xl leading-tight text-escrita text-center text-balance">
          {familiar.nome}{' '}
          <span className="text-ouro-velho">· {leitura.nome_secreto}</span>
        </h1>

        <CartaFamiliar
          pedidoId={id}
          alt={`${familiar.nome} — a carta do familiar de ${pedido.nome}`}
          legenda={LEGENDA_LUA[pedido.lua as LuaId]}
        />

        <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/40 to-transparent" />

        <TextoEscrito className="font-display italic text-lg sm:text-xl leading-relaxed text-center max-w-[34ch] text-escrita">
          {leitura.saudacao}
        </TextoEscrito>

        {/*
          Só existe pra quem comprou um produto com `narracaoAudio` (hoje,
          só a Completa) — ver `processarPedido` em `processar.ts`.
        */}
        {pedido.audio_narracao === 1 && (
          <TocaAudio src={`/api/storage/${id}/narracao.mp3`} rotulo="Ouvir a leitura narrada" />
        )}

        {pedido.signo_sol && pedido.signo_lua && (
          <Constelacao
            signoSol={pedido.signo_sol as Signo}
            signoLua={pedido.signo_lua as Signo}
            variante="papel"
          />
        )}

        <div className="leitura-grimorio flex flex-col gap-5 max-w-[62ch] self-stretch text-escrita-corpo leading-[1.75]">
          {leitura.leitura.map((paragrafo, i) => (
            <TextoEscrito key={i} className="font-corpo font-light">
              {paragrafo}
            </TextoEscrito>
          ))}
        </div>

        <TextoEscrito className="font-display italic text-xl sm:text-2xl leading-snug text-center max-w-[30ch] mt-3 text-ouro-profundo text-balance">
          {leitura.frase_de_invocacao}
        </TextoEscrito>

        {perfil && (
          <RelatorioCompleto perfil={perfil} familiar={pedido.familiar as FamiliarId} />
        )}
      </FolhaPergaminho>

      <BlocoRevelado className="flex justify-center">
        <BotaoCompartilhar
          pedidoId={id}
          textoCompartilhar={`Descobri meu familiar de bruxa: ${familiar.nome} · ${leitura.nome_secreto}.`}
        />
      </BlocoRevelado>

      {/*
        O upgrade para a Completa, por R$ 4,90.

        Só para a DONA: a página tem link público, e oferecer um upgrade a
        quem recebeu o link de outra pessoa venderia a melhoria de um pedido
        que não é dela. `podeMelhorar` cuida do resto — quem já tem a
        Completa, quem já pagou, e os exemplos do mural ficam de fora.
      */}
      {ehADona && podeMelhorar(pedido) && (
        <BlocoRevelado className="flex justify-center">
          <OfertaDaCompleta pedidoId={id} />
        </BlocoRevelado>
      )}

      {/*
        A troca por compartilhamento fica logo abaixo dos botões de
        compartilhar, e só para a dona logada — a página tem link público, e
        um estranho registraria um @ no pedido de outra pessoa.
      */}
      {ehADona && temSessaoDeConta && (
        <BlocoRevelado className="flex justify-center">
          <MarcarNoStory
            pedidoId={id}
            jaRegistrado={marcacaoDoPedido(id)?.arroba ?? null}
            conferido={!!marcacaoDoPedido(id)?.recompensado}
          />
        </BlocoRevelado>
      )}

      {/*
        ── O convite para quem chegou pelo link de outra pessoa ───────────

        O botão de compartilhar manda a REVELAÇÃO, porque é o que a pessoa
        quer mostrar ("olha o que deu pra mim"). Isso resolve metade do
        problema e cria a outra: sem este bloco, quem recebe lê a história de
        uma amiga, acha bonito, e não tem para onde ir — a página não pede
        nada, e a curiosidade morre ali.

        Só no contexto público, e só para quem NÃO é a dona: ela já tem o
        dela, e dentro do app ninguém além dela chega.
      */}
      {contexto === 'publico' && !ehADona && (
        <BlocoRevelado className="w-full max-w-md flex flex-col items-center gap-4 text-center border-t border-pergaminho/10 pt-8 sm:pt-10">
          <p className="font-display italic text-lg leading-snug text-pergaminho/80 max-w-[28ch]">
            Cada pessoa tem o seu.
          </p>
          <p className="font-corpo font-light text-sm leading-relaxed text-pergaminho/55 max-w-[34ch]">
            Vinte e seis cenas revelam qual dos doze caminha ao seu lado — com o
            seu Sol e a sua Lua na leitura que ele escreve sobre você.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition"
          >
            Descobrir o meu familiar
          </Link>
        </BlocoRevelado>
      )}

      <section className="w-full max-w-md flex flex-col items-center gap-3 text-center border-t border-pergaminho/10 pt-8 sm:pt-10">
        <p className="font-display italic text-lg leading-snug text-pergaminho/70 max-w-[30ch]">
          &ldquo;{leitura.sussurro_final}&rdquo;
        </p>
      </section>
    </>
  );
}

/**
 * A fase da lua vira anotação manuscrita sob a carta. Antes ela era só fundo
 * de imagem — aqui ela diz alguma coisa.
 */
const LEGENDA_LUA: Record<LuaId, string> = {
  nova: 'sob a lua nova, quando nada ainda tem nome',
  crescente: 'sob a lua crescente, com tudo ainda por acontecer',
  cheia: 'sob a lua cheia, quando não há onde se esconder',
  minguante: 'sob a lua minguante, na hora de deixar ir',
};

/** A vela que ilumina o quarto — a fonte da luz que a folha reflete. */
function Vela() {
  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="40" height="66" viewBox="0 0 40 66" aria-hidden="true">
        <ellipse cx="20" cy="60" rx="4" ry="4.5" fill="var(--vela)" opacity="0.35" />
        <rect
          x="18"
          y="42"
          width="4"
          height="18"
          rx="2"
          fill="var(--pergaminho)"
          opacity="0.8"
        />
        <g className="chama-tremula" style={{ transformOrigin: '20px 42px' }}>
          <path d="M20 6 C9 24, 6 34, 20 42 C34 34, 31 24, 20 6 Z" fill="var(--vela)" />
          <path
            d="M20 19 C14.5 29, 13.5 35, 20 39 C26.5 35, 25.5 29, 20 19 Z"
            fill="#FFF3D6"
            opacity="0.92"
          />
        </g>
      </svg>
      <span className="font-corpo text-[0.7rem] tracking-[0.22em] uppercase text-violeta">
        Bruxário
      </span>
    </div>
  );
}
