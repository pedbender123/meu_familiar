import Link from 'next/link';
import { buscarPedido } from '@/lib/db';
import { FAMILIARES, type FamiliarId, type LuaId } from '@/lib/familiares';
import type { Leitura } from '@/lib/leitura';
import type { Signo } from '@/lib/astro';
import { FolhaPergaminho } from '@/components/FolhaPergaminho';
import { CartaFamiliar } from '@/components/CartaFamiliar';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { TextoEscrito, BlocoRevelado } from '@/components/TextoEscrito';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { Constelacao } from '@/components/Constelacao';
import { FormularioOraculo } from '@/components/FormularioOraculo';
import { BotaoCompartilhar } from '@/components/BotaoCompartilhar';
import { RodapeLegal } from '@/components/RodapeLegal';
import { AvisoDeExpiracao, AcessoExpirado } from '@/components/AvisoDeExpiracao';
import { acessoExpirou } from '@/lib/produtos';

export const metadata = {
  robots: { index: false, follow: false },
};

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

export default async function Revelacao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);

  if (!pedido || pedido.status !== 'entregue' || !pedido.leitura_json) {
    return (
      <main className="quarto-de-vela flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
        <h1 className="font-display italic text-2xl text-pergaminho">
          Esta revelação ainda não chegou.
        </h1>
        <Link href="/" className="font-corpo text-sm text-violeta underline">
          Voltar ao início
        </Link>
      </main>
    );
  }

  // O prazo é checado no SERVIDOR, antes de qualquer render. Esconder o
  // conteúdo no cliente deixaria a leitura inteira no HTML de quem já expirou.
  if (acessoExpirou(pedido.expira_em)) {
    return <AcessoExpirado pedidoId={id} />;
  }

  const leitura: Leitura = JSON.parse(pedido.leitura_json);
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];

  return (
    <>
      <PoeiraNaLuz />

      {/*
        A composição segue a regra da estética: o que é grimório vai DENTRO da
        folha; o que é interface fica fora dela, no quarto. Por isso o botão de
        compartilhar e o oráculo vêm depois do </FolhaPergaminho> — botão sobre
        pergaminho leria como anacronismo.
      */}
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center px-5 pt-10 pb-16 gap-8 sm:gap-12 sm:pt-16">
        <Vela />

        {pedido.expira_em && (
          <AvisoDeExpiracao pedidoId={id} expiraEm={pedido.expira_em} />
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
        </FolhaPergaminho>

        <BlocoRevelado className="flex justify-center">
          <BotaoCompartilhar
            pedidoId={id}
            textoCompartilhar={`Descobri meu familiar de bruxa: ${familiar.nome} · ${leitura.nome_secreto}.`}
          />
        </BlocoRevelado>

        <section className="w-full max-w-md flex flex-col items-center gap-3.5 text-center border-t border-pergaminho/10 pt-8 sm:pt-10">
          <h2 className="font-display italic font-medium text-xl text-pergaminho">
            O Oráculo do Bruxário
          </h2>
          <p className="font-display italic text-lg leading-snug text-pergaminho/70 max-w-[30ch]">
            &ldquo;{leitura.sussurro_final}&rdquo;
          </p>
          <p className="font-corpo text-xs text-pergaminho/45 max-w-[32ch]">
            Em breve, o Oráculo abre as portas para responder.
          </p>
          <FormularioOraculo nomeSecreto={leitura.nome_secreto} />
        </section>

        <RodapeLegal />
      </main>
    </>
  );
}

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
