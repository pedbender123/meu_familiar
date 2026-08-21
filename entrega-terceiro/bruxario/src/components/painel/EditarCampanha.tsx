'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { agoraEmBrasilia } from '@/lib/periodo';

/**
 * Editar e encerrar uma campanha.
 *
 * O botão de encerrar carimba o fim com "agora" — é o gesto que você faz
 * quando pausa o anúncio, e digitar a data à mão nesse momento é atrito
 * desnecessário. Reabrir apaga o fim de volta.
 *
 * Apagar pede confirmação porque é irreversível e a campanha carrega o
 * histórico de quanto foi gasto — perder isso é perder a única prova do que o
 * anúncio custou.
 */
export function EditarCampanha({
  campanha,
}: {
  campanha: {
    id: string;
    nome: string;
    plataforma: string;
    investido: string;
    inicio: string;
    fim: string;
    nota: string;
  };
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(campanha);
  const [salvando, setSalvando] = useState(false);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar(campos?: Partial<typeof form>) {
    setSalvando(true);
    await fetch('/api/painel/campanha', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...campos, id: campanha.id }),
    });
    setSalvando(false);
    setAberto(false);
    router.refresh();
  }

  async function apagar() {
    if (!confirm(`Apagar a campanha "${campanha.nome}"? Isso não volta.`)) return;
    await fetch(`/api/painel/campanha?id=${encodeURIComponent(campanha.id)}`, {
      method: 'DELETE',
    });
    router.push('/painel/campanhas');
    router.refresh();
  }

  if (!aberto) {
    return (
      <div className="flex gap-2">
        {!campanha.fim && (
          <button
            onClick={() => salvar({ fim: agoraEmBrasilia() })}
            disabled={salvando}
            className="font-corpo text-xs px-3 py-1.5 rounded-full border border-vela/40 text-vela hover:bg-vela/10 transition disabled:opacity-40"
          >
            Encerrar agora
          </button>
        )}
        <button
          onClick={() => setAberto(true)}
          className="font-corpo text-xs px-3 py-1.5 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-vela/30 bg-vela/[0.04] px-4 py-3 flex flex-col gap-2.5 min-w-[19rem]">
      <Campo rotulo="Nome" valor={form.nome} onChange={set('nome')} />
      <div className="grid grid-cols-2 gap-2">
        <Campo rotulo="Plataforma" valor={form.plataforma} onChange={set('plataforma')} />
        <Campo rotulo="Investido (R$)" valor={form.investido} onChange={set('investido')} />
        <Campo rotulo="Começou" tipo="datetime-local" valor={form.inicio} onChange={set('inicio')} />
        <Campo rotulo="Terminou" tipo="datetime-local" valor={form.fim} onChange={set('fim')} />
      </div>
      <Campo rotulo="Nota" valor={form.nota} onChange={set('nota')} />

      <div className="flex flex-wrap gap-2 pt-1">
        <button onClick={() => salvar()} disabled={salvando}
          className="font-corpo text-xs px-4 py-1.5 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button onClick={() => setAberto(false)}
          className="font-corpo text-xs px-3 py-1.5 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition">
          Cancelar
        </button>
        <button onClick={apagar}
          className="font-corpo text-xs px-3 py-1.5 rounded-full border border-red-500/30 text-red-400/80 hover:bg-red-500/10 transition ml-auto">
          Apagar
        </button>
      </div>
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, tipo = 'text',
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: 'light dark' }}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-2.5 py-1.5 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
      />
    </label>
  );
}
