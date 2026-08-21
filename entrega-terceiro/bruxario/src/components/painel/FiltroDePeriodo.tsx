'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PRESETS } from '@/lib/periodo';

/**
 * O filtro de período, com precisão de minuto.
 *
 * Os presets são links (não botões de JS) para o painel continuar funcionando
 * como página normal — dá para abrir em outra aba, mandar o link para si
 * mesmo, voltar no histórico. Só o intervalo manual precisa de estado, porque
 * são dois campos que viram uma navegação só.
 */
export function FiltroDePeriodo({
  base,
  presetAtivo,
  deAtual,
  ateAtual,
}: {
  /** Caminho da página que recebe o filtro, ex.: `/painel/central`. */
  base: string;
  presetAtivo: string | null;
  deAtual: string;
  ateAtual: string;
}) {
  const router = useRouter();
  const busca = useSearchParams();
  const manualAberto = !!busca.get('de');

  const [aberto, setAberto] = useState(manualAberto);
  const [de, setDe] = useState(deAtual);
  const [ate, setAte] = useState(ateAtual);

  function aplicar() {
    const p = new URLSearchParams();
    p.set('de', de);
    p.set('ate', ate);
    router.push(`${base}?${p.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex flex-wrap gap-1.5 justify-end">
        {PRESETS.map((p) => {
          const ativo = !manualAberto && presetAtivo === p.id;
          return (
            <Link
              key={p.id}
              href={`${base}?p=${p.id}`}
              className={[
                'font-corpo text-xs px-3 py-1.5 rounded-full border transition',
                ativo
                  ? 'border-vela text-vela bg-vela/10'
                  : 'border-pergaminho/15 text-pergaminho/50 hover:text-pergaminho hover:border-pergaminho/35',
              ].join(' ')}
            >
              {p.rotulo}
            </Link>
          );
        })}
        <button
          onClick={() => setAberto((a) => !a)}
          className={[
            'font-corpo text-xs px-3 py-1.5 rounded-full border transition',
            manualAberto
              ? 'border-vela text-vela bg-vela/10'
              : 'border-pergaminho/15 text-pergaminho/50 hover:text-pergaminho hover:border-pergaminho/35',
          ].join(' ')}
        >
          Intervalo exato
        </button>
      </div>

      {aberto && (
        <div className="flex flex-wrap items-end gap-2 justify-end">
          <Campo rotulo="de" valor={de} onChange={setDe} />
          <Campo rotulo="até" valor={ate} onChange={setAte} />
          <button
            onClick={aplicar}
            className="font-corpo text-xs px-4 py-2 rounded-lg bg-vela text-tinta font-medium hover:brightness-110 transition"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <input
        type="datetime-local"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'light dark' }}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-3 py-1.5 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
      />
    </label>
  );
}
