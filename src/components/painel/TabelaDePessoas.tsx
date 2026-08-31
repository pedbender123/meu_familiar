'use client';

import { useMemo, useState } from 'react';
import type { PessoaDoPeriodo } from '@/lib/campanhas';
import { dataHoraBr } from '@/lib/periodo';

type Ordem = 'longe' | 'visitas' | 'recente';
type Recorte = 'todos' | 'compraram' | 'tentaram' | 'largaram' | 'email' | 'voltaram';

const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;

/** Comprou = o dinheiro entrou. Independe de a entrega já ter saído. */
const comprou = (p: PessoaDoPeriodo) => p.pagoEm !== null;

/**
 * Chegou na tela de pagamento, apertou pagar, e não pagou.
 *
 * É o recorte mais acionável da tela e o que não existia: essa pessoa já
 * decidiu comprar. Ela não desistiu do produto — ou o cartão recusou, ou o
 * Pix expirou, ou algo do nosso lado falhou. Antes ela aparecia idêntica a
 * quem fechou a aba na primeira cena.
 */
const tentouENaoPagou = (p: PessoaDoPeriodo) => !comprou(p) && p.tentativasPagamento > 0;

/** Como o gateway chama cada bandeira, traduzido para quem lê o painel. */
const NOME_DO_METODO: Record<string, string> = {
  pix: 'Pix',
  master: 'Mastercard',
  visa: 'Visa',
  elo: 'Elo',
  amex: 'Amex',
  hipercard: 'Hipercard',
  debvisa: 'Visa débito',
  debmaster: 'Master débito',
  bolbradesco: 'Boleto',
  account_money: 'Saldo MP',
  cartao: 'Cartão',
  fake: 'Modo teste',
};

const legivel = (m: string | null) => (m ? (NOME_DO_METODO[m] ?? m) : null);

/**
 * O ícone da situação — a coluna que se lê sem ler.
 *
 * Quem abre esta tela quer varrer trezentas linhas procurando padrão, não
 * decifrar palavra por palavra. Cor e forma resolvem isso; o texto ao lado
 * fica para quem parou numa linha específica.
 *
 * As quatro situações são deliberadamente distintas: comprou, tentou e não
 * conseguiu, chegou perto, e passou batido. Juntar as duas do meio — que era
 * o comportamento antigo — apaga a diferença entre desinteresse e falha
 * nossa.
 */
function Situacao({ p }: { p: PessoaDoPeriodo }) {
  if (comprou(p)) {
    const metodo = legivel(p.metodoPagamento);
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" style={{ color: '#4ADE80' }}>
        <span aria-hidden="true">●</span>
        <span>
          {p.pagouCentavos ? brl(p.pagouCentavos) : 'pagou'}
          {metodo && <span className="opacity-60"> · {metodo}</span>}
        </span>
      </span>
    );
  }

  if (tentouENaoPagou(p)) {
    const metodo = legivel(p.metodoTentado);
    return (
      <span
        className="inline-flex items-center gap-1.5 whitespace-nowrap"
        style={{ color: '#F87171' }}
        title={p.motivoRecusa ?? 'Apertou pagar e a cobrança não confirmou.'}
      >
        <span aria-hidden="true">▲</span>
        <span>
          tentou{metodo ? ` no ${metodo}` : ''}
          {p.tentativasPagamento > 1 && (
            <span className="opacity-60"> · {p.tentativasPagamento}×</span>
          )}
        </span>
      </span>
    );
  }

  if (p.cenaMaxima > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-pergaminho/45">
        <span aria-hidden="true">◐</span>
        <span>parou na cena {p.cenaMaxima}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-pergaminho/25">
      <span aria-hidden="true">○</span>
      <span>só passou</span>
    </span>
  );
}

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
      lista = lista.filter((p) => p.cenaMaxima > 0 && !comprou(p) && p.tentativasPagamento === 0);
    if (recorte === 'email') lista = lista.filter((p) => p.email);
    if (recorte === 'compraram') lista = lista.filter(comprou);
    if (recorte === 'tentaram') lista = lista.filter(tentouENaoPagou);

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter((p) =>
        [p.nome, p.email, p.origem, p.familiar, p.visitante, p.metodoPagamento, p.metodoTentado]
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

  /*
    A ordem é do dinheiro para longe dele: comprou, tentou e não conseguiu,
    chegou perto, deixou contato, voltou. Quem abre esta tela está atrás de
    uma dessas cinco coisas, e as duas primeiras são as que viram ação hoje.
  */
  const RECORTES: { id: Recorte; rotulo: string; n: number; cor?: string }[] = [
    { id: 'todos', rotulo: 'Todos', n: pessoas.length },
    { id: 'compraram', rotulo: 'Compraram', n: pessoas.filter(comprou).length, cor: '#4ADE80' },
    {
      id: 'tentaram',
      rotulo: 'Tentaram e não pagaram',
      n: pessoas.filter(tentouENaoPagou).length,
      cor: '#F87171',
    },
    {
      id: 'largaram',
      rotulo: 'Largaram no meio',
      n: pessoas.filter((p) => p.cenaMaxima > 0 && !comprou(p) && p.tentativasPagamento === 0).length,
    },
    { id: 'email', rotulo: 'Deixaram e-mail', n: pessoas.filter((p) => p.email).length },
    { id: 'voltaram', rotulo: 'Voltaram', n: pessoas.filter((p) => p.visitas > 1).length },
  ];

  function baixarCsv() {
    const cab = [
      'visitante', 'visitas', 'cena_maxima', 'origem', 'dispositivo',
      'primeira_vez', 'ultima_vez', 'email', 'nome', 'nascimento',
      'familiar', 'status', 'pagou_centavos',
      'pago_em', 'metodo_pago', 'metodo_tentado', 'tentativas', 'motivo_recusa',
    ];
    const linhas = filtradas.map((p) =>
      [
        p.visitante, p.visitas, p.cenaMaxima, p.origem ?? '', p.dispositivo ?? '',
        p.primeiraVez, p.ultimaVez, p.email ?? '', p.nome ?? '', p.nascimento ?? '',
        p.familiar ?? '', p.statusPedido ?? '', p.pagouCentavos ?? '',
        p.pagoEm ?? '', p.metodoPagamento ?? '', p.metodoTentado ?? '',
        p.tentativasPagamento, p.motivoRecusa ?? '',
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
            {/*
              A bolinha colorida só nos recortes que valem dinheiro, e só
              quando há alguém neles. Pintar um zero chamaria atenção para
              nada — que é como um painel ensina a ignorar cor.
            */}
            {rc.cor && rc.n > 0 && (
              <span className="mr-1.5" style={{ color: rc.cor }} aria-hidden="true">
                ●
              </span>
            )}
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
              {/*
                A situação vem PRIMEIRO, e não no fim da linha.

                Ela é a única coluna que responde "isso aqui deu dinheiro?", e
                estava depois de nove outras — fora da tela sem rolar na
                horizontal. Quem varre trezentas linhas atrás de padrão nunca
                a via.
              */}
              {['situação', 'pessoa', 'visitas', 'foi até', 'origem', 'aparelho', 'e-mail', 'nome', 'nasceu', 'familiar', 'última vez'].map(
                (c, i) => (
                  <th key={c} scope="col"
                    className={`font-medium px-2.5 py-2 whitespace-nowrap ${i < 2 ? 'text-left' : i < 5 ? 'text-right' : 'text-left'}`}>
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
                <td className="px-2.5 py-1.5">
                  <Situacao p={p} />
                </td>
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
