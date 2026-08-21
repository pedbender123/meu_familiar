import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import { PoeiraNaLuz } from '@/components/PoeiraNaLuz';
import { RodapeLegal } from '@/components/RodapeLegal';
import { Oferta } from '@/components/Oferta';
import { MarcoDaOferta } from '@/components/MarcoDaOferta';
import { SigiloFamiliar } from '@/components/SigiloFamiliar';
import { BlocoRevelado } from '@/components/TextoEscrito';
import { buscarPedido } from '@/lib/db';
import { PRODUTOS } from '@/lib/produtos';
import { precoComDesconto, validarCupom } from '@/lib/cupons';
import { CUPOM_DE_LANCAMENTO } from '@/lib/lancamento';
import { FAMILIARES, type FamiliarId } from '@/lib/familiares';
import { GRUPOS, ehGrupo } from '@/lib/quiz/grupos';
import { TOTAL_DE_ITENS } from '@/lib/quiz/itens';
import type { Eixo } from '@/lib/quiz/eixos';
import { produtoVigente } from '@/lib/modelo-de-venda';

export const metadata = {
  title: 'Alguém atravessou por você — Bruxário',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * A tela pós-teste. **É aqui que a venda acontece — e é aqui que ela morria.**
 *
 * ── O que os números disseram ─────────────────────────────────────────────
 *
 * Na campanha de 07/08: 216 pessoas chegaram, 28 começaram o ritual, 7
 * terminaram e viram esta tela, e **1** clicou num plano. Ninguém pagou.
 *
 * A versão anterior entregava, depois de 26 cenas e uns treze minutos, UMA
 * frase de quinze palavras e dois cartões de preço. Não havia nada para
 * olhar, nenhuma prova de que o teste mediu alguma coisa, e nenhuma ponte
 * entre a frase e o botão. Curiosidade sem recompensa nenhuma não lê como
 * mistério — lê como "perdi treze minutos".
 *
 * ── O que mudou, e por quê ────────────────────────────────────────────────
 *
 * 1. **O véu.** A arte real, borrada no servidor até virar presença (ver
 *    `gerarVeu`). Dá peso visual sem entregar o bicho — e prova que existe
 *    uma imagem esperando do outro lado.
 * 2. **O sigilo dela.** Geometria própria de cada familiar, desenhada. É
 *    dela, é bonito, e não diz qual animal é.
 * 3. **O que o teste mediu**, em palavras. Os eixos viram duas ou três frases
 *    sobre ela — a prova concreta de que as 26 respostas foram lidas.
 * 4. **Concordância de gênero.** Sete dos doze familiares são femininos e a
 *    tela dizia "ele" para todos (ver `vozes.ts`).
 */
export default async function SeuFamiliar({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pedido = buscarPedido(id);
  if (!pedido) notFound();

  // Já pagou: não faz sentido oferecer de novo.
  if (pedido.status === 'entregue') redirect(`/revelacao/${id}`);
  if (pedido.status !== 'aguardando_pagamento') redirect(`/obrigado/${id}`);

  const grupo = ehGrupo(pedido.grupo) ? GRUPOS[pedido.grupo] : null;
  const familiar = FAMILIARES[pedido.familiar as FamiliarId];

  const lancamento = validarCupom(CUPOM_DE_LANCAMENTO);
  const desconto = lancamento.ok ? lancamento.cupom.desconto_percentual : 0;

  const tracos = tracosDoPerfil(pedido.perfil_json);

  return (
    <>
      <PoeiraNaLuz />
      <MarcoDaOferta />
      <main className="quarto-de-vela relative z-10 flex-1 flex flex-col items-center gap-10 sm:gap-12 px-5 py-12">
        {/* ── a chegada ── */}
        <section className="w-full max-w-md flex flex-col items-center gap-5 text-center">
          {/*
            Sem pronome aqui, de propósito. O familiar ainda é provisório — e
            os grupos são de gênero MISTO (o de "caminho" tem Raposa e Lebre
            femininas e Lobo masculino). Dizer "ela atravessou" seria acertar
            por sorte em dois terços dos casos e errar no resto, bem no
            momento em que a pessoa está decidindo confiar no que o teste diz.
            O pronome só aparece depois das 26 cenas, quando existe resposta.
          */}
          <span className="font-corpo text-[0.65rem] tracking-[0.24em] uppercase text-violeta">
            {`${pedido.nome}, alguma coisa atravessou o véu`}
          </span>

          <h1 className="font-display italic text-3xl sm:text-4xl leading-tight text-vela text-balance">
            {grupo ? grupo.nome : 'Você foi visto por inteiro.'}
          </h1>

          {grupo && (
            <p className="font-corpo font-light text-[0.95rem] text-pergaminho/75 leading-relaxed max-w-[40ch]">
              {grupo.retrato}
            </p>
          )}

          {/*
            O véu. Ainda não é `next/image` otimizado por acaso: `unoptimized`
            evita que o Next gere uma versão redimensionada — e o pipeline de
            redimensionamento poderia, em tese, recuperar detalhe que o
            borrão deveria ter destruído.
          */}
          <BlocoRevelado className="relative w-56 h-56 sm:w-64 sm:h-64">
            <Image
              src={`/api/storage/${id}/veu.webp`}
              alt="Uma presença atrás do véu"
              width={640}
              height={640}
              unoptimized
              className="w-full h-full object-contain rounded-full"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-70">
              <SigiloFamiliar sigilo={familiar.sigilo} tamanho={150} variante="quarto" />
            </div>
          </BlocoRevelado>

          <p className="font-corpo text-[11px] text-pergaminho/40 max-w-[32ch] leading-relaxed">
            Alguma coisa atravessou. A forma dela só aparece do outro lado.
          </p>
        </section>

        {/* ── os três candidatos ── */}
        {grupo && (
          <section className="w-full max-w-md flex flex-col items-center gap-4 text-center">
            <h2 className="font-corpo text-[0.65rem] tracking-[0.24em] uppercase text-violeta">
              Um destes três é o seu
            </h2>
            <ul className="flex gap-3 justify-center flex-wrap">
              {grupo.familiares.map((id) => (
                <li key={id} className="flex flex-col items-center gap-2 opacity-70">
                  <SigiloFamiliar sigilo={FAMILIARES[id].sigilo} tamanho={64}
                    variante="quarto" animado={false} />
                  <span className="font-corpo text-[11px] text-pergaminho/40">?</span>
                </li>
              ))}
            </ul>
            <p className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed max-w-[40ch]">
              Três sigilos, três naturezas. As cenas que faltam dizem qual
              delas veio te encontrar — e essa parte é a sua leitura.
            </p>
          </section>
        )}

        {/* ── a prova de que o teste leu (só quando há perfil dos 4 eixos) ── */}
        {tracos.length > 0 && (
          <section className="w-full max-w-md flex flex-col items-center gap-4 text-center">
            <h2 className="font-corpo text-[0.65rem] tracking-[0.24em] uppercase text-violeta">
              {`O que suas ${TOTAL_DE_ITENS} respostas mostraram`}
            </h2>
            <ul className="flex flex-col gap-2.5 self-stretch">
              {tracos.map((t) => (
                <li
                  key={t}
                  className="font-corpo font-light text-[0.95rem] text-pergaminho/75 leading-relaxed border-l-2 border-vela/30 pl-4 text-left"
                >
                  {t}
                </li>
              ))}
            </ul>
            <p className="font-corpo text-[11px] text-pergaminho/40 max-w-[38ch] leading-relaxed">
              Isto é o resumo. A leitura completa liga cada uma dessas coisas
              às escolhas que você fez, cena por cena — e diz o nome de quem
              te encontrou.
            </p>
          </section>
        )}

        {/* ── a oferta ── */}
        <Oferta
          pedidoId={id}
          descontoPercentual={desconto}
          precos={{
            revelacao: precoComDesconto(produtoVigente('revelacao'), desconto),
            completa: precoComDesconto(produtoVigente('completa'), desconto),
          }}
          {...(pedido.ritual_completo === 1
            ? { generoDoFamiliar: familiar.genero }
            : {})}
        />

        <RodapeLegal />
      </main>
    </>
  );
}

/**
 * Os eixos viram frases sobre a pessoa.
 *
 * ── Por que só os extremos ────────────────────────────────────────────────
 *
 * Dizer "você está na média em tudo" não é leitura, é ruído — e é o caso da
 * maioria das pessoas em pelo menos dois eixos. Só entram os traços que
 * destoam de verdade (|z| ≥ 0,7), porque só esses a pessoa reconhece como
 * "isso sou eu". Se nenhum destoar, a seção some inteira em vez de mostrar
 * banalidade.
 */
function tracosDoPerfil(perfilJson: string | null): string[] {
  if (!perfilJson) return [];

  const FRASES: Record<Eixo, { alto: string; baixo: string }> = {
    agencia: {
      alto: 'Você age antes de ter certeza. Onde a maioria espera alguém decidir, você já decidiu.',
      baixo: 'Você espera o momento certo em vez de forçar o seu. Isso passa por calma, e nem sempre é.',
    },
    comunhao: {
      alto: 'Você sente o clima de um ambiente antes das palavras. Cuidar do outro vem antes de perceber que está fazendo isso.',
      baixo: 'Você protege o que é seu antes de dividir. Não é frieza — é seleção.',
    },
    abertura: {
      alto: 'O que é estranho te atrai mais do que o que é seguro. Você troca de ideia sem achar que perdeu.',
      baixo: 'Você confia no que já provou funcionar. Novidade precisa se explicar antes de entrar.',
    },
    estabilidade: {
      alto: 'Você absorve pancada sem quebrar o passo. Por fora, quase nada aparece.',
      baixo: 'Você sente tudo em volume alto. É o que te faz perceber cedo o que os outros só notam depois.',
    },
  };

  try {
    const eixos = JSON.parse(perfilJson).eixos as Record<string, number>;
    return (['agencia', 'comunhao', 'abertura', 'estabilidade'] as Eixo[])
      .map((eixo) => ({ eixo, z: eixos?.[eixo] ?? 0 }))
      .filter((x) => Math.abs(x.z) >= 0.7)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
      .slice(0, 3)
      .map((x) => (x.z > 0 ? FRASES[x.eixo].alto : FRASES[x.eixo].baixo));
  } catch {
    return [];
  }
}
