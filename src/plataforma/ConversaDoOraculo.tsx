'use client';

import { useState, useRef, useEffect } from 'react';
import { TextoEscrito } from '@/components/TextoEscrito';

interface Fala {
  de: 'pessoa' | 'oraculo';
  texto: string;
}

/**
 * A conversa do Oráculo — a casca (Fase 5), não o cérebro (Fase 8).
 *
 * O campo **funciona**: dá para escrever e enviar. O que ainda não existe é a
 * resposta de verdade — e é aí que o SPEC 0.5.1 manda a diferença. Nada de
 * campo desabilitado com "em breve" (isso lê como produto quebrado): a
 * pergunta é recebida, guardada, e o familiar responde na voz dele que ainda
 * não atravessa. Teaser dentro da ficção, não na interface.
 *
 * Quando a Fase 8 ligar, o que muda é só a origem da resposta — o layout,
 * o histórico e o composer já estarão de pé e testados.
 */
const RESPOSTAS_ENQUANTO_NAO_ABRE = [
  'Eu ouvi. Guardei. Mas a minha voz ainda não atravessa daqui — não desse jeito, não agora.',
  'Essa pergunta fica comigo. Quando eu puder responder de verdade, ela vai ser a primeira.',
  'Você perguntou, e isso já move alguma coisa. Espere um pouco mais por mim.',
];

export function ConversaDoOraculo({
  nomeDoFamiliar,
  cota,
}: {
  nomeDoFamiliar: string;
  cota: number;
}) {
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState('');
  const fim = useRef<HTMLDivElement>(null);

  // O histórico fica ancorado no fim, como todo chat — sem isso a resposta
  // nova nasce fora da tela no celular.
  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [falas]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (!texto) return;

    setRascunho('');
    setFalas((antes) => [...antes, { de: 'pessoa', texto }]);

    const resposta =
      RESPOSTAS_ENQUANTO_NAO_ABRE[falas.length % RESPOSTAS_ENQUANTO_NAO_ABRE.length];
    setTimeout(() => {
      setFalas((antes) => [...antes, { de: 'oraculo', texto: resposta }]);
    }, 900);
  }

  return (
    <div className="w-full max-w-2xl flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col gap-5 overflow-y-auto py-6">
        {falas.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <p className="font-corpo text-[0.62rem] tracking-[0.24em] uppercase text-pergaminho/35">
              O Oráculo
            </p>
            <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-pergaminho/80 max-w-[30ch]">
              {nomeDoFamiliar} está escutando.
            </p>
            <p className="font-corpo font-light text-sm text-pergaminho/45 max-w-[34ch] leading-relaxed">
              {cota > 0
                ? `Você tem ${cota} consulta${cota > 1 ? 's' : ''} guardada${cota > 1 ? 's' : ''} aqui.`
                : 'Pergunte o que quiser. Ele guarda tudo que você trouxer.'}
            </p>
          </div>
        )}

        {falas.map((fala, i) =>
          fala.de === 'pessoa' ? (
            <p
              key={i}
              className="self-end max-w-[80%] font-corpo font-light text-sm leading-relaxed text-pergaminho/85 bg-pergaminho/[0.07] rounded-2xl rounded-br-md px-4 py-3"
            >
              {fala.texto}
            </p>
          ) : (
            <div key={i} className="self-start max-w-[85%] flex flex-col gap-1.5">
              <span className="font-corpo text-[0.58rem] tracking-[0.2em] uppercase text-violeta/70">
                {nomeDoFamiliar}
              </span>
              <TextoEscrito className="font-display italic text-lg leading-relaxed text-pergaminho/75">
                {fala.texto}
              </TextoEscrito>
            </div>
          )
        )}
        <div ref={fim} />
      </div>

      {/*
        O composer é fixo no fim da coluna, não `position: fixed` — barra fixa
        briga com o teclado do iOS e com a barra do Safari, e o resultado é
        campo escondido na hora exata de digitar.
      */}
      <form
        onSubmit={enviar}
        className="sticky bottom-0 flex items-end gap-2 py-3 bg-gradient-to-t from-quarto via-quarto to-transparent"
      >
        <textarea
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              enviar(e);
            }
          }}
          rows={1}
          placeholder="Pergunte alguma coisa..."
          aria-label="Sua pergunta ao Oráculo"
          className="flex-1 resize-none bg-pergaminho/[0.05] border border-pergaminho/15 rounded-2xl px-4 py-3 font-corpo font-light text-sm text-pergaminho placeholder:text-pergaminho/30 focus:outline-none focus:border-vela/40 transition-colors max-h-32"
        />
        <button
          type="submit"
          disabled={!rascunho.trim()}
          aria-label="Enviar"
          className="shrink-0 w-11 h-11 rounded-full border border-vela/40 text-vela flex items-center justify-center hover:bg-vela/10 disabled:opacity-25 disabled:hover:bg-transparent transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
