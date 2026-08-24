'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EscolhaDeFunis } from './EscolhaDeFunis';
import { EscolhaDeCheckout } from './EscolhaDeCheckout';
import type { FunilId } from '@/lib/funis';
import type { NomeDoGateway } from '@/nucleo/checkouts/nomes';
import { agoraEmBrasilia } from '@/lib/periodo';

/**
 * Cria uma campanha. O `fim` em branco significa "ainda no ar" — e é o caso
 * normal na hora de subir o anúncio, quando você sabe quando começou mas não
 * quando vai parar. O relatório usa "agora" como fim enquanto isso.
 */
export function FormularioDeCampanha() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // `inicio` nasce vazio e é preenchido com "agora" no clique que abre o
  // formulário — ler o relógio durante o render é impuro (React 19 recusa), e
  // preencher na abertura é o momento semanticamente certo de qualquer jeito.
  const [form, setForm] = useState({
    nome: '',
    plataforma: 'instagram',
    inicio: '',
    fim: '',
    investido: '',
    alcance_estimado: '',
    nota: '',
  });

  /**
   * Começa no funil que já vendeu.
   *
   * Todas as vendas até aqui saíram da landing com as 26 cenas. Uma campanha
   * nova nascer apontando para uma aposta não validada seria trocar o certo
   * pelo talvez sem ninguém ter decidido isso.
   */
  const [funis, setFunis] = useState<FunilId[]>(['padrao']);
  /** `null` = segue o padrão do servidor, como toda campanha antiga. */
  const [gateway, setGateway] = useState<NomeDoGateway | null>(null);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      const r = await fetch('/api/painel/campanha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, funis, gateway }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? 'Não deu para salvar.');
        setSalvando(false);
        return;
      }
      setAberto(false);
      setSalvando(false);
      setForm((f) => ({ ...f, nome: '', investido: '', nota: '' }));
      router.refresh();
    } catch {
      setErro('Falha de rede.');
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => {
          setForm((f) => ({ ...f, inicio: f.inicio || agoraEmBrasilia() }));
          setAberto(true);
        }}
        className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
      >
        Nova campanha
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-vela/30 bg-vela/[0.04] px-5 py-4 flex flex-col gap-3">
      <h3 className="font-corpo font-medium text-sm text-pergaminho/85">
        Nova campanha
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Campo rotulo="Nome" valor={form.nome} onChange={set('nome')}
          placeholder="Story 07/08 — teste do bilhete" />
        <div className="sm:col-span-2">
          <EscolhaDeFunis valor={funis} onChange={setFunis} />

          <EscolhaDeCheckout valor={gateway} onChange={setGateway} />
        </div>

        <Seletor rotulo="Plataforma" valor={form.plataforma} onChange={set('plataforma')}
          opcoes={['instagram', 'tiktok', 'youtube', 'whatsapp', 'outro']} />
        <Campo rotulo="Investido (R$)" valor={form.investido} onChange={set('investido')}
          placeholder="50,00" />
        <Campo rotulo="Começou em" tipo="datetime-local" valor={form.inicio} onChange={set('inicio')} />
        <Campo rotulo="Termina em (vazio = no ar)" tipo="datetime-local"
          valor={form.fim} onChange={set('fim')} />
        <Campo rotulo="Alcance estimado" valor={form.alcance_estimado}
          onChange={set('alcance_estimado')} placeholder="3000" />
      </div>

      <Campo rotulo="Nota" valor={form.nota} onChange={set('nota')}
        placeholder="público, criativo usado, o que você quer testar..." />

      {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}

      <div className="flex gap-2">
        <button onClick={salvar} disabled={salvando}
          className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
          {salvando ? 'Salvando...' : 'Criar campanha'}
        </button>
        <button onClick={() => setAberto(false)}
          className="font-corpo text-xs px-4 py-2 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, placeholder, tipo = 'text',
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        style={{ colorScheme: 'light dark' }}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none"
      />
    </label>
  );
}

function Seletor({
  rotulo, valor, onChange, opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: string[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        style={{ background: 'var(--admin-superficie)' }}
          className="border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
      >
        {opcoes.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
