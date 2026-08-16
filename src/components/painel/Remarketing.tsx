'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Contato, Envio } from '@/lib/remarketing';
import { dataHoraBr } from '@/lib/periodo';

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

type Recorte = 'quentes' | 'largaram' | 'clientes' | 'todos';

/**
 * A tela de remarketing: quem receber, o que oferecer, e o texto de cada um.
 *
 * ── A ordem dos recortes não é alfabética ─────────────────────────────────
 *
 * "Quase pagou" vem primeiro porque é o grupo com maior chance de converter:
 * a pessoa já quis, já escolheu plano, já viu o checkout — falta empurrão, não
 * convencimento. Quem só deixou e-mail na cena 2 é o oposto, e recebe o mesmo
 * desconto com muito menos retorno.
 *
 * ── Descadastrados aparecem, riscados, e não dá para marcar ───────────────
 *
 * Some-los esconderia o motivo de a lista encolher. Mostrar barrado ensina o
 * tamanho real do custo de mandar demais.
 */
export function Remarketing({
  contatos,
  rascunhos,
  produtos,
}: {
  contatos: Contato[];
  rascunhos: Envio[];
  produtos: { id: string; nome: string; precoCentavos: number }[];
}) {
  const router = useRouter();
  const [recorte, setRecorte] = useState<Recorte>('quentes');
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [produto, setProduto] = useState(produtos[produtos.length - 1]?.id ?? 'completa');
  const [desconto, setDesconto] = useState('45');
  const [ideia, setIdeia] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  const grupos = useMemo(() => {
    const quentes = contatos.filter((c) => !c.comprou.length && c.abriuCheckout);
    const largaram = contatos.filter(
      (c) => !c.comprou.length && !c.abriuCheckout && c.cenaMaxima > 0
    );
    const clientes = contatos.filter((c) => c.comprou.length > 0);
    return { quentes, largaram, clientes, todos: contatos };
  }, [contatos]);

  const lista = useMemo(() => {
    const base = grupos[recorte];
    const q = busca.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) =>
      [c.email, c.nome, c.origem].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [grupos, recorte, busca]);

  const selecionaveis = lista.filter((c) => !c.descadastrado);
  const todosMarcados =
    selecionaveis.length > 0 && selecionaveis.every((c) => marcados.has(c.email));

  function alternar(email: string) {
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(email)) novo.delete(email);
      else novo.add(email);
      return novo;
    });
  }

  function alternarTodos() {
    setMarcados((m) => {
      const novo = new Set(m);
      if (todosMarcados) selecionaveis.forEach((c) => novo.delete(c.email));
      else selecionaveis.forEach((c) => novo.add(c.email));
      return novo;
    });
  }

  const prod = produtos.find((p) => p.id === produto);
  const pct = Math.min(90, Math.max(1, Number(desconto) || 0));
  const precoFinal = prod ? Math.round(prod.precoCentavos * (1 - pct / 100)) : 0;

  async function gerar() {
    setErro('');
    if (marcados.size === 0) return setErro('Marque pelo menos uma pessoa.');
    if (!ideia.trim()) return setErro('Escreva a ideia da mensagem.');

    setGerando(true);
    try {
      const r = await fetch('/api/painel/remarketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: [...marcados],
          ideia,
          produto,
          desconto: pct,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? 'Não deu para gerar.');
      } else {
        setMarcados(new Set());
        router.refresh();
      }
    } catch {
      setErro('Falha de rede.');
    }
    setGerando(false);
  }

  const RECORTES: { id: Recorte; rotulo: string; n: number; nota: string }[] = [
    { id: 'quentes', rotulo: 'Quase pagou', n: grupos.quentes.length, nota: 'viu o checkout e não pagou' },
    { id: 'largaram', rotulo: 'Largou no meio', n: grupos.largaram.length, nota: 'respondeu e parou antes da oferta' },
    { id: 'clientes', rotulo: 'Já comprou', n: grupos.clientes.length, nota: 'oferta de upgrade' },
    { id: 'todos', rotulo: 'Todos', n: grupos.todos.length, nota: '' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* ── a oferta ── */}
      <div className="superficie rounded-xl border px-5 py-4 flex flex-col gap-4"
        style={{ borderColor: 'var(--admin-borda)' }}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
              Produto ofertado
            </span>
            <select value={produto} onChange={(e) => setProduto(e.target.value)}
              style={{ background: 'var(--admin-superficie)' }}
              className="border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho focus:border-vela outline-none">
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} — {brl(p.precoCentavos)}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
              Desconto (%)
            </span>
            <input value={desconto} onChange={(e) => setDesconto(e.target.value)}
              className="w-20 bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho focus:border-vela outline-none" />
          </label>

          {prod && (
            <p className="font-corpo text-xs text-pergaminho/60 pb-2">
              Sai por <span className="text-vela">{brl(precoFinal)}</span>
              <span className="text-pergaminho/35"> em vez de {brl(prod.precoCentavos)}</span>
            </p>
          )}

          <p className="font-corpo text-xs text-pergaminho/45 pb-2 ml-auto">
            {marcados.size} selecionada{marcados.size === 1 ? '' : 's'}
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-corpo text-[10px] uppercase tracking-[0.14em] text-pergaminho/40">
            A ideia da mensagem — vira a direção do texto de cada pessoa
          </span>
          <textarea
            value={ideia}
            onChange={(e) => setIdeia(e.target.value)}
            rows={3}
            placeholder="Ex.: o familiar dela continua esperando desde que ela parou; sem drama, sem pressa, só lembrar que a porta continua aberta e que agora está mais barato."
            className="bg-transparent border border-pergaminho/20 rounded-lg px-3 py-2 font-corpo text-xs text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none leading-relaxed resize-y"
          />
        </label>

        {erro && <p className="font-corpo text-xs text-red-400">{erro}</p>}

        <div className="flex items-center gap-3">
          <button onClick={gerar} disabled={gerando || marcados.size === 0}
            className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
            {gerando ? 'Escrevendo...' : `Escrever ${marcados.size || ''} e-mail${marcados.size === 1 ? '' : 's'}`}
          </button>
          <span className="font-corpo text-[11px] text-pergaminho/35">
            Os textos ficam como rascunho — você lê cada um antes de enviar.
          </span>
        </div>
      </div>

      {/* ── quem ── */}
      <div className="flex flex-wrap items-center gap-2">
        {RECORTES.map((rc) => (
          <button key={rc.id} onClick={() => setRecorte(rc.id)}
            title={rc.nota}
            className={[
              'font-corpo text-[11px] px-3 py-1.5 rounded-full border transition',
              recorte === rc.id
                ? 'border-vela text-vela bg-vela/10'
                : 'border-pergaminho/15 text-pergaminho/50 hover:text-pergaminho',
            ].join(' ')}>
            {rc.rotulo} <span className="tabular-nums opacity-60">{rc.n}</span>
          </button>
        ))}
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="buscar e-mail ou nome..."
          className="ml-auto bg-transparent border border-pergaminho/20 rounded-lg px-3 py-1.5 font-corpo text-[11px] text-pergaminho placeholder:text-pergaminho/25 focus:border-vela outline-none min-w-[13rem]" />
      </div>

      <div className="w-full overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--admin-borda)' }}>
        <table className="w-full border-collapse font-corpo text-[11px] min-w-[52rem]">
          <thead>
            <tr className="text-pergaminho/40">
              <th className="px-2.5 py-2 w-8">
                <input type="checkbox" checked={todosMarcados} onChange={alternarTodos}
                  aria-label="Marcar todos" />
              </th>
              {['e-mail', 'nome', 'foi até', 'situação', 'gastou', 'já recebeu', 'última vez', ''].map((c) => (
                <th key={c} scope="col" className="text-left font-medium px-2.5 py-2 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-pergaminho/75">
            {lista.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-5 text-pergaminho/30 text-center">
                  Ninguém neste recorte.
                </td>
              </tr>
            )}
            {lista.map((c) => (
              <tr key={c.email}
                className={`border-t hover:bg-pergaminho/[0.03] ${c.descadastrado ? 'opacity-40' : ''}`}
                style={{ borderColor: 'var(--admin-borda)' }}>
                <td className="px-2.5 py-1.5">
                  <input type="checkbox" disabled={c.descadastrado}
                    checked={marcados.has(c.email)} onChange={() => alternar(c.email)}
                    aria-label={`Selecionar ${c.email}`} />
                </td>
                <td className="px-2.5 py-1.5 max-w-[16rem] truncate">
                  {c.descadastrado ? <s>{c.email}</s> : c.email}
                </td>
                <td className="px-2.5 py-1.5">{c.nome ?? '—'}</td>
                <td className="px-2.5 py-1.5 tabular-nums">
                  {c.cenaMaxima > 0 ? `cena ${c.cenaMaxima}` : '—'}
                </td>
                <td className="px-2.5 py-1.5">
                  {c.comprou.length > 0 ? (
                    <span className="text-vela">{c.comprou.join(' + ')}</span>
                  ) : c.abriuCheckout ? (
                    <span style={{ color: '#D97A7A' }}>viu o checkout</span>
                  ) : (
                    <span className="text-pergaminho/40">não comprou</span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 tabular-nums">
                  {c.gastouCentavos > 0 ? brl(c.gastouCentavos) : '—'}
                </td>
                <td className="px-2.5 py-1.5 tabular-nums">
                  {c.jaRecebeu > 0 ? (
                    <span className="text-pergaminho/70">{c.jaRecebeu} oferta{c.jaRecebeu > 1 ? 's' : ''}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2.5 py-1.5 text-pergaminho/45 whitespace-nowrap">
                  {dataHoraBr(c.ultimaVez)}
                </td>
                <td className="px-2.5 py-1.5">
                  <Link href={`/painel/remarketing/${encodeURIComponent(c.email)}`}
                    className="text-pergaminho/40 hover:text-vela transition underline underline-offset-2">
                    ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rascunhos.length > 0 && <Rascunhos rascunhos={rascunhos} />}
    </div>
  );
}

/* ── os rascunhos esperando revisão ─────────────────────────────────────── */

function Rascunhos({ rascunhos }: { rascunhos: Envio[] }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [enviandoTudo, setEnviandoTudo] = useState(false);
  const [resultado, setResultado] = useState('');

  async function enviar(id: string) {
    setEnviando(id);
    const r = await fetch('/api/painel/remarketing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setEnviando(null);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setResultado(d.erro ?? 'Falhou.');
    }
    router.refresh();
  }

  async function enviarTodos() {
    if (!confirm(`Enviar ${rascunhos.length} e-mails agora?`)) return;
    setEnviandoTudo(true);
    let ok = 0;
    let falhou = 0;
    // Em série, de propósito: disparar tudo junto estoura limite de taxa do
    // Resend e alguns somem sem erro visível.
    for (const r of rascunhos) {
      const resp = await fetch('/api/painel/remarketing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      });
      if (resp.ok) ok += 1;
      else falhou += 1;
    }
    setEnviandoTudo(false);
    setResultado(`${ok} enviados${falhou ? `, ${falhou} falharam` : ''}.`);
    router.refresh();
  }

  async function descartar(id: string) {
    await fetch(`/api/painel/remarketing?id=${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/85">
          Esperando sua revisão ({rascunhos.length})
        </h2>
        <button onClick={enviarTodos} disabled={enviandoTudo}
          className="font-corpo text-xs px-4 py-1.5 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40">
          {enviandoTudo ? 'Enviando...' : 'Enviar todos'}
        </button>
        {resultado && (
          <span className="font-corpo text-[11px] text-pergaminho/60">{resultado}</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rascunhos.map((r) => {
          const { paragrafos, textoDoBotao } = JSON.parse(r.corpo) as {
            paragrafos: string[];
            textoDoBotao: string;
          };
          return (
            <div key={r.id}
              className="superficie rounded-xl border px-4 py-3 flex flex-col gap-2"
              style={{ borderColor: 'var(--admin-borda)' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-corpo text-xs text-pergaminho">
                  {r.nome ? `${r.nome} · ` : ''}
                  <span className="text-pergaminho/50">{r.email}</span>
                </span>
                <span className="font-corpo text-[11px] text-pergaminho/40">
                  {r.desconto_percentual}% · {r.cupom}
                </span>
              </div>

              <p className="font-corpo text-xs text-vela">{r.assunto}</p>

              {paragrafos.map((p, i) => (
                <p key={i} className="font-corpo font-light text-[12px] text-pergaminho/70 leading-relaxed">
                  {p}
                </p>
              ))}

              <p className="font-corpo text-[11px] text-pergaminho/40">
                botão: &ldquo;{textoDoBotao}&rdquo;
              </p>

              <div className="flex gap-2 pt-1">
                <button onClick={() => enviar(r.id)} disabled={enviando === r.id}
                  className="font-corpo text-[11px] px-3 py-1.5 rounded-full border border-vela/40 text-vela hover:bg-vela/10 transition disabled:opacity-40">
                  {enviando === r.id ? 'Enviando...' : 'Enviar este'}
                </button>
                <button onClick={() => descartar(r.id)}
                  className="font-corpo text-[11px] px-3 py-1.5 rounded-full border border-pergaminho/20 text-pergaminho/50 hover:text-red-400 transition">
                  Descartar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
