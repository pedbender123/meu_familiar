'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CATEGORIAS, type Despesa } from '@/lib/financeiro-tipos';
import { dataHoraBr } from '@/lib/periodo';

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

/**
 * Lançamento e listagem de despesas.
 *
 * ── O que NÃO se lança aqui ───────────────────────────────────────────────
 *
 * Taxa do Mercado Pago e custo de IA. As duas o sistema já calcula sozinho
 * (uma lida da resposta do gateway, outra estimada por tokens) e entram no
 * lucro por outro caminho. Lançar à mão contaria duas vezes — e um lucro que
 * desconta o mesmo custo duas vezes é pior que nenhum número.
 */
export function Despesas({
  despesas,
  campanhas,
}: {
  despesas: Despesa[];
  campanhas: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'anuncio',
    valor: '',
    ocorrido_em: '',
    campanha_id: '',
    nota: '',
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function salvar() {
    setErro('');
    setSalvando(true);
    const r = await fetch('/api/painel/despesa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(d.erro ?? 'Não deu para salvar.');
    setAberto(false);
    setForm((f) => ({ ...f, descricao: '', valor: '', nota: '' }));
    router.refresh();
  }

  async function apagar(id: string, descricao: string) {
    if (!confirm(`Apagar "${descricao}"?`)) return;
    await fetch(`/api/painel/despesa?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {!aberto ? (
        <button
          onClick={() => {
            // A data nasce vazia e recebe "hoje" no clique: ler o relógio
            // durante o render é impuro, e o React 19 recusa.
            setForm((f) => ({
              ...f,
              ocorrido_em: f.ocorrido_em || new Date().toISOString().slice(0, 10),
            }));
            setAberto(true);
          }}
          className="self-start font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
        >
          Lançar gasto
        </button>
      ) : (
        <div className="rounded-xl border border-vela/30 bg-vela/[0.04] px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Campo rotulo="Descrição" valor={form.descricao} onChange={set('descricao')}
              placeholder="Anúncio story 07/08" />
            <Seletor rotulo="Categoria" valor={form.categoria} onChange={set('categoria')}
              opcoes={CATEGORIAS.map((c) => ({ v: c, t: c }))} />
            <Campo rotulo="Valor (R$)" valor={form.valor} onChange={set('valor')}
              placeholder="150,00" />
            <Campo rotulo="Quando" tipo="date" valor={form.ocorrido_em}
              onChange={set('ocorrido_em')} />
            <Seletor rotulo="Campanha (opcional)" valor={form.campanha_id}
              onChange={set('campanha_id')}
              opcoes={[{ v: '', t: '— nenhuma —' }, ...campanhas.map((c) => ({ v: c.id, t: c.nome }))]} />
            <Campo rotulo="Nota" valor={form.nota} onChange={set('nota')} />
          </div>

          {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}

          <div className="flex gap-2">
            <button onClick={salvar} disabled={salvando}
              className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
              {salvando ? 'Salvando...' : 'Lançar'}
            </button>
            <button onClick={() => setAberto(false)}
              className="font-corpo text-xs px-4 py-2 rounded-full border border-pergaminho/20 text-pergaminho/60 hover:text-pergaminho transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {despesas.length === 0 ? (
        <p className="font-corpo text-xs text-pergaminho/30 py-4 text-center">
          Nenhum gasto lançado.
        </p>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg border"
          style={{ borderColor: 'var(--admin-borda)' }}>
          <table className="w-full border-collapse font-corpo text-[11px]">
            <thead>
              <tr className="text-pergaminho/40">
                {['quando', 'descrição', 'categoria', 'campanha', 'valor', ''].map((c) => (
                  <th key={c} scope="col" className="text-left font-medium px-2.5 py-2">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-pergaminho/75">
              {despesas.map((d) => (
                <tr key={d.id} className="border-t" style={{ borderColor: 'var(--admin-borda)' }}>
                  <td className="px-2.5 py-1.5 tabular-nums text-pergaminho/50 whitespace-nowrap">
                    {dataHoraBr(d.ocorrido_em).slice(0, 5)}
                  </td>
                  <td className="px-2.5 py-1.5">{d.descricao}</td>
                  <td className="px-2.5 py-1.5 text-pergaminho/50">{d.categoria}</td>
                  <td className="px-2.5 py-1.5 text-pergaminho/50">
                    {campanhas.find((c) => c.id === d.campanha_id)?.nome ?? '—'}
                  </td>
                  <td className="px-2.5 py-1.5 tabular-nums whitespace-nowrap">
                    {brl(d.valor_centavos)}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <button onClick={() => apagar(d.id, d.descricao)}
                      className="text-pergaminho/30 hover:text-red-400 transition">
                      apagar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Campo({
  rotulo, valor, onChange, placeholder, tipo = 'text',
}: {
  rotulo: string; valor: string; onChange: (v: string) => void;
  placeholder?: string; tipo?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ colorScheme: 'light dark' }}
        className="bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none" />
    </label>
  );
}

function Seletor({
  rotulo, valor, onChange, opcoes,
}: {
  rotulo: string; valor: string; onChange: (v: string) => void;
  opcoes: { v: string; t: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
        {rotulo}
      </span>
      <select value={valor} onChange={(e) => onChange(e.target.value)}
        className="border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
        style={{ background: 'var(--admin-superficie)' }}>
        {opcoes.map((o) => (
          <option key={o.v} value={o.v}>{o.t}</option>
        ))}
      </select>
    </label>
  );
}
