'use client';

import { useState } from 'react';
import { BONUS_DE_CONSULTAS } from '@/lib/recompensa';

/**
 * A troca: compartilha nos stories, ganha consultas ao Oráculo.
 *
 * ── O que a tela promete, e o que ela cumpre ──────────────────────────────
 *
 * Ela diz, em letra legível, que o Oráculo **ainda não abriu** e que as
 * consultas ficam guardadas. Isso não é rodapé: está na mesma frase que
 * oferece a recompensa. Uma tela que prometesse "10 consultas" sem dizer que
 * não há nada para consultar ainda estaria comprando divulgação com fumaça —
 * e é exatamente assim que a maioria dessas mecânicas é escrita.
 *
 * ── Por que só aparece para quem comprou e está logada ────────────────────
 *
 * A revelação tem link público. Sem a checagem, um estranho com o link
 * registraria um @ no pedido de outra pessoa, e a fila de conferência viraria
 * lixo.
 */
export function MarcarNoStory({
  pedidoId,
  jaRegistrado,
  conferido,
}: {
  pedidoId: string;
  jaRegistrado?: string | null;
  conferido?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [arroba, setArroba] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(!!jaRegistrado);

  async function registrar() {
    if (!arroba.trim()) return;
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/marcacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId, arroba }),
      });
      const d = await r.json();
      if (d.ok) setPronto(true);
      else setErro(d.erro || 'Não deu para registrar.');
    } catch {
      setErro('Não deu para registrar agora.');
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <section className="w-full max-w-md rounded-2xl border border-vela/35 bg-vela/[0.06] px-5 py-4 flex flex-col gap-2 text-center">
        <p className="font-display italic text-lg text-vela">
          {conferido
            ? `Recompensa liberada — +${BONUS_DE_CONSULTAS} consultas`
            : 'Registrado. Vamos conferir a marcação.'}
        </p>
        <p className="font-corpo font-light text-xs text-pergaminho/60 leading-relaxed">
          {conferido
            ? 'As consultas estão guardadas na sua conta, esperando o Oráculo abrir.'
            : `Assim que virmos o seu story, as ${BONUS_DE_CONSULTAS} consultas entram na sua conta. Se você tirou o story antes da gente ver, é só postar de novo.`}
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-pergaminho/18 px-5 py-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-center">
        <p className="font-display italic text-xl text-pergaminho text-balance">
          {`Poste nos stories e ganhe ${BONUS_DE_CONSULTAS} consultas ao Oráculo`}
        </p>
        <p className="font-corpo font-light text-sm text-pergaminho/65 leading-relaxed">
          Compartilhe a sua revelação marcando{' '}
          <span className="text-vela">@bruxario_</span>, registre o seu @ aqui, e
          você entra também no acesso antecipado quando o Oráculo abrir.
        </p>
        <p className="font-corpo text-xs text-pergaminho/45 leading-relaxed">
          O Oráculo ainda não existe — não prometemos data. As consultas ficam
          guardadas na sua conta até lá.
        </p>
      </div>

      {!aberto ? (
        <button
          onClick={() => setAberto(true)}
          className="bg-vela text-tinta font-corpo font-medium px-6 py-3 rounded-full hover:brightness-110 transition self-center"
        >
          Já marquei — registrar meu @
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={arroba}
              onChange={(e) => setArroba(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registrar()}
              placeholder="@seu.perfil"
              maxLength={40}
              aria-label="Seu @ no Instagram"
              className="flex-1 min-w-0 bg-transparent border border-pergaminho/25 rounded-lg px-4 py-3 font-corpo text-sm text-pergaminho placeholder:text-pergaminho/35 focus:border-vela focus:outline-none"
            />
            <button
              onClick={registrar}
              disabled={enviando || !arroba.trim()}
              className="bg-vela text-tinta font-corpo text-sm font-medium px-5 rounded-lg hover:brightness-110 transition disabled:opacity-40 shrink-0"
            >
              {enviando ? '...' : 'Enviar'}
            </button>
          </div>
          {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}
          <p className="font-corpo text-[11px] text-pergaminho/40 leading-relaxed">
            Conferimos manualmente no Instagram. Seu @ é usado só para isso.
          </p>
        </div>
      )}
    </section>
  );
}
