'use client';

import { useMemo, useState } from 'react';
import type { PessoaDoPeriodo } from '@/lib/campanhas';
import { dataHoraBr } from '@/lib/periodo';

type Ordem = 'longe' | 'visitas' | 'recente';
type Recorte = 'todos' | 'voltaram' | 'largaram' | 'email' | 'compraram';

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

/**
 * A tabela pessoa a pessoa — o lado CRM do painel.
 *
 * ── Sem IP, e por quê ─────────────────────────────────────────────────────
 *
 * A identidade aqui é o `visitante`: um id aleatório num cookie primeiro-parte,
 * sem relação com nome nem documento. É o que a política de privacidade
 * promete, e é MAIS preciso que IP para "quem voltou" — IP de celular é
 * compartilhado por milhares de pessoas pela operadora, então repetição de IP
 * juntaria estranhos como se fossem a mesma pessoa.
 *
 * ── Filtro no cliente ─────────────────────────────────────────────────────
 *
 * Os recortes rodam sobre a lista já carregada, sem ida ao servidor: são
 * centenas de linhas, não milhares, e assim trocar de recorte é instantâneo
 * enquanto você investiga.
 */
export function TabelaDePessoas({ pessoas }: { pessoas: PessoaDoPeriodo[] }) {
  const [recorte, setRecorte] = useState<Recorte>('todos');
  const [ordem, setOrdem] = useState<Ordem>('longe');
  const [busca, setBusca] = useState('');
  const [mostrar, setMostrar] = useState(50);

  const filtradas = useMemo(() => {
    let lista = pessoas;

    if (recorte === 'voltaram') lista = lista.filter((p) => p.visitas > 1);
    if (recorte === 'largaram')
      lista = lista.filter((p) => p.cenaMaxima > 0 && p.statusPedido === null);
    if (recorte === 'email') lista = lista.filter((p) => p.email);
    if (recorte === 'compraram')
      lista = lista.filter((p) => p.statusPedido === 'entregue');

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter((p) =>
        [p.nome, p.email, p.origem, p.familiar, p.visitante]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }

    const copia = [...lista];
    if (ordem === 'visitas') copia.sort((a, b) => b.visitas - a.visitas);
    if (ordem === 'recente')
      copia.sort((a, b) => b.ultimaVez.localeCompare(a.ultimaVez));
    if (ordem === 'longe')
      copia.sort((a, b) => b.cenaMaxima - a.cenaMaxima || b.visitas - a.visitas);
    return copia;
  }, [pessoas, recorte, ordem, busca]);

  const RECORTES: { id: Recorte; rotulo: string; n: number }[] = [
    { id: 'todos', rotulo: 'Todos', n: pessoas.length },
    { id: 'voltaram', rotulo: 'Voltaram', n: pessoas.filter((p) => p.visitas > 1).length },
    {
      id: 'largaram',
      rotulo: 'Largaram no meio',
      n: pessoas.filter((p) => p.cenaMaxima > 0 && p.statusPedido === null).length,
    },
    { id: 'email', rotulo: 'Deixaram e-mail', n: pessoas.filter((p) => p.email).length },
    {
      id: 'compraram',
      rotulo: 'Compraram',
      n: pessoas.filter((p) => p.statusPedido === 'entregue').length,
    },
  ];

  function baixarCsv() {
    const cab = [
      'visitante', 'visitas', 'cena_maxima', 'origem', 'dispositivo',
      'primeira_vez', 'ultima_vez', 'email', 'nome', 'nascimento',
      'familiar', 'status', 'pagou_centavos',
    ];
    const linhas = filtradas.map((p) =>
      [
        p.visitante, p.visitas, p.cenaMaxima, p.origem ?? '', p.dispositivo ?? '',
        p.primeiraVez, p.ultimaVez, p.email ?? '', p.nome ?? '', p.nascimento ?? '',
        p.familiar ?? '', p.statusPedido ?? '', p.pagouCentavos ?? '',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [cab.join(','), ...linhas].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bruxario-pessoas-${new Date().toISOString().slice(0, 16)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {RECORTES.map((rc) => (
          <button
            key={rc.id}
            onClick={() => { setRecorte(rc.id); setMostrar(50); }}
            className={[
              'font-corpo text-[11px] px-3 py-1.5 rounded-full border transition',
              recorte === rc.id
                ? 'border-vela text-vela bg-vela/10'
                : 'border-pergaminho/15 text-pergaminho/50 hover:text-pergaminho',
            ].join(' ')}
          >
            {rc.rotulo} <span className="tabular-nums opacity-60">{rc.n}</span>
          </button>
        ))}

        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="buscar nome, e-mail, origem..."
          className="ml-auto bg-transparent border border-pergaminho/20 rounded-lg px-3 py-1.5 font-corpo text-[11px] text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none min-w-[13rem]"
        />

        <select
          value={ordem}
          onChange={(e) => setOrdem(e.target.value as Ordem)}
          style={{ background: 'var(--admin-superficie)' }}
          className="border border-pergaminho/20 rounded-lg px-2 py-1.5 font-corpo text-[11px] text-pergaminho/70 focus:border-vela outline-none"
        >
          <option value="longe">Foi mais longe</option>
          <option value="visitas">Mais visitas</option>
          <option value="recente">Mais recente</option>
        </select>

        <button
          onClick={baixarCsv}
          className="font-corpo text-[11px] px-3 py-1.5 rounded-lg border border-pergaminho/20 text-pergaminho/60 hover:text-vela hover:border-vela/40 transition"
        >
          Baixar CSV
        </button>
      </div>

      <div className="w-full overflow-x-auto rounded-xl border border-pergaminho/12">
        <table className="w-full border-collapse font-corpo text-[11px] min-w-[58rem]">
          <thead>
            <tr className="text-pergaminho/40">
              {['pessoa', 'visitas', 'foi até', 'origem', 'aparelho', 'e-mail', 'nome', 'nasceu', 'familiar', 'situação', 'última vez'].map(
                (c, i) => (
                  <th key={c} scope="col"
                    className={`font-medium px-2.5 py-2 whitespace-nowrap ${i === 0 ? 'text-left' : i < 3 ? 'text-right' : 'text-left'}`}>
                    {c}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="text-pergaminho/75">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-5 text-pergaminho/30 text-center">
                  Ninguém neste recorte.
                </td>
              </tr>
            )}
            {filtradas.slice(0, mostrar).map((p) => (
              <tr key={p.visitante} className="border-t border-pergaminho/8 hover:bg-pergaminho/[0.03]">
                <td className="px-2.5 py-1.5 font-mono text-[10px] text-pergaminho/35">
                  {p.visitante.slice(0, 8)}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {p.visitas > 1 ? (
                    <span className="text-vela">{p.visitas}</span>
                  ) : (
                    p.visitas
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  {p.cenaMaxima > 0 ? `cena ${p.cenaMaxima}` : '—'}
                </td>
                <td className="px-2.5 py-1.5">{p.origem ?? '—'}</td>
                <td className="px-2.5 py-1.5">{p.dispositivo ?? '—'}</td>
                <td className="px-2.5 py-1.5 max-w-[15rem] truncate">{p.email ?? '—'}</td>
                <td className="px-2.5 py-1.5">{p.nome ?? '—'}</td>
                <td className="px-2.5 py-1.5 tabular-nums">{p.nascimento ?? '—'}</td>
                <td className="px-2.5 py-1.5">{p.familiar ?? '—'}</td>
                <td className="px-2.5 py-1.5">
                  {p.statusPedido === 'entregue' ? (
                    <span className="text-vela">
                      pagou{p.pagouCentavos ? ` ${brl(p.pagouCentavos)}` : ''}
                    </span>
                  ) : (
                    p.statusPedido ?? '—'
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-pergaminho/45 whitespace-nowrap">
                  {dataHoraBr(p.ultimaVez)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtradas.length > mostrar && (
        <button
          onClick={() => setMostrar((m) => m + 100)}
          className="self-center font-corpo text-[11px] text-pergaminho/45 hover:text-vela underline underline-offset-4 transition"
        >
          Mostrar mais ({filtradas.length - mostrar} restantes)
        </button>
      )}
    </div>
  );
}
