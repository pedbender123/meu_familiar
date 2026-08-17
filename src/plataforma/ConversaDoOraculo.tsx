'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { TextoEscrito } from '@/components/TextoEscrito';
import { Sugestoes, type Sugestao } from './oraculo/Sugestoes';
import { PainelDeCotas, type Cota } from './oraculo/PainelDeCotas';
import { Ritual } from './oraculo/Ritual';
import type { ResultadoDoEspetaculo } from '@/modulos/oraculo/espetaculos';
import type { LeituraDoOraculo } from '@/modulos/oraculo/leitura';

/**
 * A conversa do Oráculo — as duas moedas na mesma tela.
 *
 * ── A escolha do tipo é do usuário, e é explícita ─────────────────────────
 *
 * Deixar o modelo decidir se a pergunta "merece" uma leitura seria cobrar a
 * moeda cara sem a pessoa mandar — o jeito mais rápido de perder confiança
 * num produto com cota. Aqui ela escolhe: escrever e enviar manda uma
 * mensagem; pedir leitura é um botão à parte, com outra cor.
 */
interface Fala {
  de: 'pessoa' | 'oraculo';
  texto?: string;
  leitura?: LeituraDoOraculo;
  espetaculos?: ResultadoDoEspetaculo[];
  diaDeOuro?: boolean;
}

export function ConversaDoOraculo({
  nomeDoFamiliar,
  cotaDeMensagens,
  cotaDeLeituras,
}: {
  nomeDoFamiliar: string;
  cotaDeMensagens: Cota;
  cotaDeLeituras: Cota;
}) {
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState('');
  const [ocupado, setOcupado] = useState<'mensagem' | 'leitura' | null>(null);
  /**
   * A leitura que já chegou do servidor mas ainda NÃO pode aparecer: o ritual
   * está rodando. Sem esta gaveta, a resposta surgiria no meio das cartas
   * virando e estragaria as duas coisas — o teatro e o texto.
   */
  const [aguardandoRitual, setAguardandoRitual] = useState<Fala | null>(null);
  const [ritual, setRitual] = useState<{
    espetaculos: ResultadoDoEspetaculo[];
    diaDeOuro: boolean;
  } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState(cotaDeMensagens);
  const [leituras, setLeituras] = useState(cotaDeLeituras);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [falas, ocupado]);

  async function consultar(pergunta: string, tipo: 'mensagem' | 'leitura') {
    const texto = pergunta.trim();
    if (!texto || ocupado) return;

    setErro(null);
    setRascunho('');
    setOcupado(tipo);
    setFalas((antes) => [...antes, { de: 'pessoa', texto }]);

    try {
      const resposta = await fetch('/api/oraculo/consultar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: texto, tipo }),
      });
      const corpo = await resposta.json();

      if (!resposta.ok) {
        setErro(
          corpo?.erro === 'sem_cota'
            ? corpo.motivo === 'sem_cota_no_dia'
              ? 'Seu limite de hoje acabou. Volte amanhã.'
              : 'Sua cota do mês acabou.'
            : (corpo?.erro ?? 'Não consegui responder agora.')
        );
        return;
      }

      if (tipo === 'leitura') {
        // O teatro começa AGORA, com os símbolos que vieram junto; o texto
        // fica guardado até ele acabar.
        setRitual({ espetaculos: corpo.espetaculos, diaDeOuro: corpo.diaDeOuro });
        setAguardandoRitual({
          de: 'oraculo',
          leitura: corpo.leitura,
          espetaculos: corpo.espetaculos,
          diaDeOuro: corpo.diaDeOuro,
        });
      } else {
        setFalas((antes) => [...antes, { de: 'oraculo', texto: corpo.resposta }]);
      }

      const atualizar = (c: Cota): Cota => ({
        ...c,
        disponivel: Math.max(0, Math.min(corpo.restante.hoje, corpo.restante.mes)),
        restanteHoje: Math.max(0, corpo.restante.hoje),
        restanteNoMes: Math.max(0, corpo.restante.mes),
      });
      if (tipo === 'leitura') setLeituras(atualizar); else setMensagens(atualizar);
    } catch {
      setErro('Não consegui responder agora. Nada foi cobrado.');
    } finally {
      setOcupado(null);
    }
  }

  const vazio = falas.length === 0;

  return (
    <div className="w-full max-w-2xl flex flex-col flex-1 min-h-0 gap-3">
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto py-2">
        {vazio && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-2 py-6">
            <p className="font-corpo text-[0.62rem] tracking-[0.24em] uppercase text-pergaminho/35">
              O Oráculo
            </p>
            <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-pergaminho/85 max-w-[28ch]">
              {nomeDoFamiliar} está escutando.
            </p>
            <Sugestoes
              aoEscolher={(s: Sugestao) => consultar(s.texto, s.tipo)}
              podeLeitura={leituras.disponivel > 0}
              podeMensagem={mensagens.disponivel > 0}
            />
          </div>
        )}

        {falas.map((fala, i) =>
          fala.de === 'pessoa' ? (
            <p
              key={i}
              className="self-end max-w-[82%] font-corpo font-light text-sm leading-relaxed text-pergaminho/85 bg-pergaminho/[0.07] rounded-2xl rounded-br-md px-4 py-3"
            >
              {fala.texto}
            </p>
          ) : fala.leitura ? (
            <Leitura key={i} fala={fala} nomeDoFamiliar={nomeDoFamiliar} />
          ) : (
            <div key={i} className="self-start max-w-[88%] flex flex-col gap-1.5">
              <span className="font-corpo text-[0.55rem] tracking-[0.22em] uppercase text-violeta/70">
                {nomeDoFamiliar}
              </span>
              <TextoEscrito className="font-display italic text-lg leading-relaxed text-pergaminho/80">
                {fala.texto!}
              </TextoEscrito>
            </div>
          )
        )}

        {ritual && (
          <Ritual
            espetaculos={ritual.espetaculos}
            diaDeOuro={ritual.diaDeOuro}
            aoTerminar={() => {
              setFalas((antes) =>
                aguardandoRitual ? [...antes, aguardandoRitual] : antes
              );
              setAguardandoRitual(null);
              setRitual(null);
            }}
          />
        )}

        {ocupado && !ritual && <Esperando tipo={ocupado} nomeDoFamiliar={nomeDoFamiliar} />}
        <div ref={fim} />
      </div>

      {erro && (
        <p role="alert" className="font-corpo text-sm text-vela text-center">
          {erro}
        </p>
      )}

      <PainelDeCotas mensagens={mensagens} leituras={leituras} />

      <Link
        href="/conta/oraculo/historico"
        className="self-center font-corpo text-xs text-pergaminho/35 hover:text-pergaminho/70 transition-colors"
      >
        ver tudo que já foi dito →
      </Link>

      {!vazio && (
        <Sugestoes
          aoEscolher={(s: Sugestao) => consultar(s.texto, s.tipo)}
          podeLeitura={leituras.disponivel > 0 && !ocupado}
          podeMensagem={mensagens.disponivel > 0 && !ocupado}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          consultar(rascunho, 'mensagem');
        }}
        className="flex items-end gap-2 pb-1"
      >
        <textarea
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              consultar(rascunho, 'mensagem');
            }
          }}
          rows={1}
          disabled={!!ocupado}
          placeholder={
            mensagens.disponivel > 0
              ? 'Pergunte alguma coisa...'
              : 'Suas mensagens de hoje acabaram'
          }
          aria-label="Sua pergunta ao Oráculo"
          className="flex-1 resize-none bg-pergaminho/[0.05] border border-pergaminho/15 rounded-2xl px-4 py-3 font-corpo font-light text-sm text-pergaminho placeholder:text-pergaminho/30 focus:outline-none focus:border-vela/40 disabled:opacity-40 transition-colors max-h-32"
        />

        <button
          type="submit"
          disabled={!rascunho.trim() || !!ocupado || mensagens.disponivel === 0}
          aria-label="Enviar mensagem"
          className="shrink-0 w-11 h-11 rounded-full border border-pergaminho/25 text-pergaminho/70 flex items-center justify-center hover:border-pergaminho/50 hover:text-pergaminho disabled:opacity-25 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>

        {/*
          Pedir leitura com o que está escrito. Botão separado, cor separada:
          a moeda cara nunca sai por engano de quem só queria mandar um texto.
        */}
        <button
          type="button"
          onClick={() => consultar(rascunho, 'leitura')}
          disabled={!rascunho.trim() || !!ocupado || leituras.disponivel === 0}
          title="Fazer uma leitura completa sobre isto"
          aria-label="Fazer uma leitura"
          className="shrink-0 h-11 px-4 rounded-full border border-vela/50 text-vela flex items-center gap-1.5 hover:bg-vela/10 disabled:opacity-25 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l1.9 6.1H20l-4.9 3.8 1.9 6.1-5-3.8-5 3.8 1.9-6.1L4 8.1h6.1z" />
          </svg>
          <span className="font-corpo text-xs">leitura</span>
        </button>
      </form>
    </div>
  );
}

/**
 * A espera.
 *
 * Ela é longa de propósito na leitura (o ritual acontece enquanto o modelo
 * trabalha), então não pode ser um spinner mudo: cada frase que troca é sinal
 * de que algo está acontecendo. Sem isso a espera lê como travamento, e a
 * pessoa recarrega a página no meio.
 */
function Esperando({
  tipo,
  nomeDoFamiliar,
}: {
  tipo: 'mensagem' | 'leitura';
  nomeDoFamiliar: string;
}) {
  const PASSOS =
    tipo === 'leitura'
      ? [
          'Acendendo a vela...',
          'As cartas estão sendo tiradas...',
          'O céu deste minuto está sendo lido...',
          'Os símbolos estão se arrumando...',
          `${nomeDoFamiliar} está escrevendo...`,
        ]
      : [`${nomeDoFamiliar} está pensando...`];

  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (PASSOS.length === 1) return;
    const t = setInterval(
      () => setPasso((p) => Math.min(p + 1, PASSOS.length - 1)),
      3400
    );
    return () => clearInterval(t);
  }, [PASSOS.length]);

  return (
    <div className="self-start flex items-center gap-2.5">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-vela/60"
            style={{
              animation: 'cintilar 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </span>
      <span className="font-corpo text-sm text-pergaminho/45 italic">
        {PASSOS[passo]}
      </span>
    </div>
  );
}

/** A leitura, símbolo por símbolo — cada um ao lado do que ele diz. */
function Leitura({ fala, nomeDoFamiliar }: { fala: Fala; nomeDoFamiliar: string }) {
  const leitura = fala.leitura!;
  const porNome = new Map(
    (fala.espetaculos ?? []).flatMap((e) => e.simbolos).map((s) => [s.nome, s])
  );

  return (
    <div
      className="self-start w-full flex flex-col gap-5 p-5 rounded-2xl border"
      style={{
        borderColor: fala.diaDeOuro ? 'rgba(217,164,65,0.4)' : 'rgba(234,224,204,0.12)',
        background: fala.diaDeOuro
          ? 'linear-gradient(160deg, rgba(217,164,65,0.1), rgba(234,224,204,0.02))'
          : 'rgba(234,224,204,0.03)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-corpo text-[0.55rem] tracking-[0.22em] uppercase text-violeta/70">
          {nomeDoFamiliar} · leitura
        </span>
        {fala.diaDeOuro && (
          <span
            className="font-corpo text-[0.55rem] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full"
            style={{ background: 'var(--vela)', color: '#171225' }}
          >
            dia de ouro
          </span>
        )}
      </div>

      <p className="font-display italic text-lg leading-relaxed text-pergaminho/85">
        {leitura.abertura}
      </p>

      <div className="flex flex-col gap-4">
        {leitura.simbolos.map((s) => {
          const original = porNome.get(s.simbolo);
          return (
            <div
              key={s.simbolo}
              className="flex flex-col gap-1.5 pl-4 border-l"
              style={{
                borderColor: original?.dourado
                  ? 'var(--vela)'
                  : 'rgba(234,224,204,0.18)',
              }}
            >
              <div className="flex items-baseline gap-2 flex-wrap">
                <span
                  className="font-display italic text-base"
                  style={{ color: original?.dourado ? 'var(--vela)' : 'rgb(234 224 204 / 0.9)' }}
                >
                  {s.simbolo}
                </span>
                {original && (
                  <span className="font-corpo text-[0.62rem] text-pergaminho/35">
                    {original.posicao}
                  </span>
                )}
              </div>
              <p className="font-corpo font-light text-sm leading-relaxed text-pergaminho/70">
                {s.oQueDiz}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 pt-1 border-t border-pergaminho/10">
        <p className="font-corpo text-[0.55rem] tracking-[0.22em] uppercase text-pergaminho/35 pt-3">
          O conselho
        </p>
        <p className="font-display italic text-lg leading-relaxed text-pergaminho/85">
          {leitura.conselho}
        </p>
      </div>

      <p className="font-display italic text-base leading-relaxed text-pergaminho/55">
        {leitura.fechamento}
      </p>
    </div>
  );
}
