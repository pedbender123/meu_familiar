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
    <div className="w-full max-w-xl flex flex-col flex-1 min-h-0">
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto py-2">
        {falas.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-2">
            <p className="font-corpo text-[0.62rem] tracking-[0.26em] uppercase text-escrita-fraca">
              Capítulo III · Oráculo
            </p>
            <p className="font-display italic text-xl sm:text-2xl leading-relaxed text-escrita max-w-[28ch]">
              {nomeDoFamiliar} está escutando.
            </p>
            <hr className="w-24 h-px border-0 bg-gradient-to-r from-transparent via-escrita/30 to-transparent" />
            <p className="font-corpo font-light text-sm text-escrita-fraca max-w-[32ch] leading-relaxed">
              {cota > 0
                ? `Você tem ${cota} consulta${cota > 1 ? 's' : ''} guardada${cota > 1 ? 's' : ''} nesta página.`
                : 'Pergunte o que quiser. Ele guarda tudo que você trouxer.'}
            </p>
          </div>
        )}

        {falas.map((fala, i) =>
          fala.de === 'pessoa' ? (
            /*
              A pergunta é a letra de quem escreve NO livro — anotação à mão na
              margem, alinhada à direita e sublinhada pelo traço de tinta. Balão
              de chat aqui quebraria a ilusão na hora.
            */
            <p
              key={i}
              className="self-end max-w-[82%] text-right font-ritual text-2xl leading-snug text-ouro-profundo/90 border-b border-ouro-velho/25 pb-2"
            >
              {fala.texto}
            </p>
          ) : (
            <div key={i} className="self-start max-w-[92%] flex flex-col gap-1.5">
              <span className="font-corpo text-[0.55rem] tracking-[0.22em] uppercase text-escrita-fraca">
                {nomeDoFamiliar}
              </span>
              <TextoEscrito className="font-display italic text-lg leading-relaxed text-escrita">
                {fala.texto}
              </TextoEscrito>
            </div>
          )
        )}
        <div ref={fim} />
      </div>

      {/*
        O composer é sticky no fim da coluna, não `position: fixed` — barra
        fixa briga com o teclado do iOS e com a barra do Safari, e o resultado
        é campo escondido na hora exata de digitar.
      */}
      <form
        onSubmit={enviar}
        className="sticky bottom-0 flex items-end gap-2 py-3"
        style={{
          background:
            'linear-gradient(to top, var(--folha) 62%, rgba(231,220,196,0))',
        }}
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
          placeholder="Escreva sua pergunta..."
          aria-label="Sua pergunta ao Oráculo"
          className="flex-1 resize-none bg-transparent border-b border-escrita/25 px-1 py-2 font-ritual text-2xl text-ouro-profundo placeholder:text-escrita-fraca/50 placeholder:font-corpo placeholder:text-sm focus:outline-none focus:border-ouro-velho/60 transition-colors max-h-32"
        />
        <button
          type="submit"
          disabled={!rascunho.trim()}
          aria-label="Enviar"
          className="shrink-0 w-10 h-10 rounded-full border border-ouro-velho/45 text-ouro-profundo flex items-center justify-center hover:bg-ouro-velho/10 disabled:opacity-25 disabled:hover:bg-transparent transition-all"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
