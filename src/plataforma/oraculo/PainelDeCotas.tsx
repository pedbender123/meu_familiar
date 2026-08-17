'use client';

import { useState } from 'react';

/**
 * Quanto sobra, quando volta, e o que é cada coisa.
 *
 * ── Por que mostrar o limite o tempo todo ─────────────────────────────────
 *
 * Cota escondida é cota que a pessoa descobre batendo nela — e bater num
 * limite invisível parece punição, não plano. Visível, o mesmo número vira
 * orçamento: ela decide se gasta a leitura agora ou guarda.
 *
 * ── E por que o "?" ao lado ───────────────────────────────────────────────
 *
 * "2 leituras" não significa nada para quem nunca fez uma. A explicação
 * precisa estar a um toque de distância, mas fora do caminho — daí um
 * disclosure, não um parágrafo permanente ocupando a tela toda visita.
 */
export interface Cota {
  disponivel: number;
  tetoMensal: number;
  restanteNoMes: number;
  restanteHoje: number;
  voltaDoDia: string;
  voltaDoMes: string;
}

const EXPLICACAO = {
  mensagem: {
    titulo: 'O que é uma mensagem',
    texto:
      'É uma conversa curta: tirar uma dúvida sobre uma leitura, pedir um empurrão, perguntar como está o seu dia. O familiar responde em poucas linhas, sem cerimônia. É o do dia a dia.',
  },
  leitura: {
    titulo: 'O que é uma leitura',
    texto:
      'É o ritual completo. As cartas são tiradas, o céu do momento é lido, e o que aparece vira uma resposta longa — símbolo por símbolo — sobre a sua pergunta. Leva alguns minutos e fica guardada no seu Bruxário para você reler. Em dia de ouro, o ritual traz algo a mais.',
  },
};

function Explicacao({ qual }: { qual: 'mensagem' | 'leitura' }) {
  const [aberto, setAberto] = useState(false);
  const conteudo = EXPLICACAO[qual];

  return (
    <>
      <button
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-label={conteudo.titulo}
        className="w-4 h-4 shrink-0 rounded-full border border-current opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center text-[0.6rem] leading-none"
      >
        ?
      </button>

      {aberto && (
        <p className="basis-full font-corpo text-xs text-pergaminho/50 leading-relaxed pt-1.5">
          {conteudo.texto}
        </p>
      )}
    </>
  );
}

function Linha({
  rotulo,
  qual,
  cota,
  cor,
}: {
  rotulo: string;
  qual: 'mensagem' | 'leitura';
  cota: Cota;
  cor: string;
}) {
  /**
   * Qual limite explicar depende de qual está mordendo. Dizer "voltam em 12
   * dias" quando na verdade só o teto de hoje acabou faria a pessoa achar que
   * ficou sem nada por duas semanas — e talvez cancelar por causa disso.
   */
  const travadoNoDia = cota.restanteHoje === 0 && cota.restanteNoMes > 0;
  const esgotado = cota.disponivel === 0;

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ color: cor }}>
      <span className="font-corpo text-xs">{rotulo}</span>
      <Explicacao qual={qual} />

      <span className="ml-auto font-corpo text-xs tabular-nums">
        {esgotado ? (
          <span className="opacity-60">
            {travadoNoDia ? `volta ${cota.voltaDoDia}` : `volta ${cota.voltaDoMes}`}
          </span>
        ) : (
          <>
            <strong className="font-medium">{cota.disponivel}</strong>
            <span className="opacity-45">
              {' '}
              de {cota.tetoMensal} no mês
            </span>
          </>
        )}
      </span>
    </div>
  );
}

export function PainelDeCotas({
  mensagens,
  leituras,
}: {
  mensagens: Cota;
  leituras: Cota;
}) {
  return (
    <div className="w-full flex flex-col gap-2.5 p-3.5 rounded-xl border border-pergaminho/10 bg-pergaminho/[0.02]">
      <Linha rotulo="Mensagens" qual="mensagem" cota={mensagens} cor="rgb(234 224 204 / 0.75)" />
      <Linha rotulo="Leituras" qual="leitura" cota={leituras} cor="var(--vela)" />
    </div>
  );
}
