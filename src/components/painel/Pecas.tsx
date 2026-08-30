'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DesempenhoDaPeca } from '@/lib/campanhas';

/**
 * Os vídeos de uma campanha, com o link de cada um e o que cada um trouxe.
 *
 * ── A tabela é a decisão ──────────────────────────────────────────────────
 *
 * Ela existe para responder "qual eu pauso". Por isso a última coluna é
 * conversão e não visitas: um vídeo com 200 pessoas e nenhuma venda é pior
 * que um com 20 e duas, e uma tabela ordenada por tráfego mostraria o
 * contrário.
 *
 * ── O botão de copiar ─────────────────────────────────────────────────────
 *
 * O link precisa ir da tela para o gerenciador de anúncios sem passar por
 * digitação. Um caractere errado no código e o clique vira `direto` — que é
 * exatamente o buraco que este sistema fecha.
 */
export function Pecas({
  campanhaId,
  linhas,
  investidoCentavos,
}: {
  campanhaId: string;
  linhas: DesempenhoDaPeca[];
  investidoCentavos: number;
}) {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);

  const totalPessoas = linhas.reduce((s, l) => s + l.pessoas, 0);

  async function criar() {
    if (nome.trim().length < 3 || criando) return;
    setCriando(true);
    setErro('');
    try {
      const r = await fetch('/api/painel/peca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha_id: campanhaId, nome }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro || 'Não deu para criar.');
        setCriando(false);
        return;
      }
      setNome('');
      setCriando(false);
      router.refresh();
    } catch {
      setErro('Falha de rede.');
      setCriando(false);
    }
  }

  /**
   * Renomear.
   *
   * Virou necessário quando as peças passaram a nascer sozinhas do
   * `utm_content` do anúncio: elas chegam chamadas pelo `{{ad.id}}` da Meta,
   * dezessete dígitos, que identificam com precisão e não dizem nada a quem
   * abre esta tela um mês depois.
   *
   * `prompt` em vez de campo editável de propósito: renomear acontece uma vez
   * por criativo, e um formulário inteiro numa célula de tabela custaria mais
   * atenção do que a tarefa merece.
   */
  async function renomear(id: string, nomeAtual: string) {
    const novo = prompt(
      'Como você quer chamar este criativo?\n\n' +
        'O vínculo com o anúncio não se perde — quem identifica é o código, não o nome.',
      nomeAtual
    );
    if (novo === null) return;
    const limpo = novo.trim();
    if (limpo.length < 3 || limpo === nomeAtual) return;

    const r = await fetch('/api/painel/peca', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, nome: limpo }),
    });
    if (!r.ok) {
      const { erro } = await r.json().catch(() => ({ erro: 'Falha ao renomear.' }));
      setErro(erro ?? 'Falha ao renomear.');
      return;
    }
    router.refresh();
  }

  async function apagar(id: string, nomeDaPeca: string) {
    if (!confirm(`Tirar "${nomeDaPeca}" da lista?\n\nAs visitas e vendas que ela já trouxe continuam no histórico.`)) return;
    await fetch(`/api/painel/peca?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    router.refresh();
  }

  async function copiar(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(link);
      setTimeout(() => setCopiado(null), 1800);
    } catch {
      // clipboard bloqueado: o link está visível na tela para copiar à mão
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[220px] flex flex-col gap-1">
          <span className="text-[0.65rem] tracking-[0.14em] uppercase opacity-60">
            Novo vídeo ou criativo
          </span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criar()}
            placeholder="gata preta olhando pra câmera"
            maxLength={80}
            className="bg-transparent border border-pergaminho/20 rounded-lg px-2.5 py-1.5 font-corpo text-xs text-pergaminho focus:border-vela outline-none"
          />
        </label>
        <button
          onClick={criar}
          disabled={nome.trim().length < 3 || criando}
          className="font-corpo text-xs px-4 py-1.5 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition disabled:opacity-40"
        >
          {criando ? 'Criando…' : 'Criar link'}
        </button>
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}

      {linhas.length === 0 ? (
        <p className="text-sm opacity-60 leading-relaxed">
          Nenhuma peça ainda. Crie uma para cada vídeo que for ao ar — é o que
          permite saber qual deles trouxe cada venda, em vez de somar tudo num
          número que não decide nada.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-[0.65rem] tracking-[0.14em] uppercase opacity-55">
                <th className="py-2 pr-3 font-normal">Peça</th>
                <th className="py-2 pr-3 font-normal">Link</th>
                <th className="py-2 pr-3 font-normal text-right">Pessoas</th>
                <th className="py-2 pr-3 font-normal text-right">Entraram</th>
                <th className="py-2 pr-3 font-normal text-right">Viram preço</th>
                <th className="py-2 pr-3 font-normal text-right">Vendas</th>
                <th className="py-2 pr-3 font-normal text-right">Receita</th>
                <th className="py-2 pr-3 font-normal text-right">Conversão</th>
                <th className="py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const conversao = l.pessoas > 0 ? (l.vendas / l.pessoas) * 100 : 0;
                /**
                 * O investimento é rateado pela fatia de tráfego da peça.
                 *
                 * Não é o custo real dela — as plataformas cobram por peça e
                 * o número exato está lá, não aqui. É a melhor aproximação
                 * possível com o que o sistema sabe, e está rotulada como
                 * estimativa para ninguém confundir com fatura.
                 */
                const fatia = totalPessoas > 0 ? l.pessoas / totalPessoas : 0;
                const custo = investidoCentavos * fatia;
                const cpa = l.vendas > 0 ? custo / l.vendas : null;
                return (
                  <tr key={l.peca_id ?? 'sem-peca'} className="border-t border-pergaminho/10">
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-xs opacity-60 mr-2">{l.codigo}</span>
                      {/*
                        O nome leva ao funil individual do vídeo. A tabela
                        responde "qual vende mais"; a tela de dentro responde
                        "onde as pessoas deste vídeo desistem", que é a
                        pergunta que muda o criativo.
                      */}
                      <Link
                        href={`/painel/campanhas/${campanhaId}/peca/${l.peca_id ?? 'sem-peca'}`}
                        className="hover:text-vela transition underline decoration-dotted underline-offset-2"
                        title="Abrir o funil deste vídeo"
                      >
                        {l.nome}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        onClick={() => copiar(l.link)}
                        title="Copiar o link para colar no anúncio"
                        className="font-mono text-xs underline decoration-dotted underline-offset-4 hover:opacity-80"
                      >
                        {copiado === l.link ? 'copiado ✓' : l.link.replace(/^https?:\/\//, '')}
                      </button>
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{l.pessoas}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums opacity-75">{l.entraram}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums opacity-75">{l.viramOferta}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{l.vendas}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {l.receitaCentavos > 0
                        ? `R$ ${(l.receitaCentavos / 100).toFixed(2).replace('.', ',')}`
                        : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {l.pessoas > 0 ? `${conversao.toFixed(1)}%` : '—'}
                      {cpa !== null && (
                        <span className="block text-[10px] opacity-50">
                          ~R$ {(cpa / 100).toFixed(2).replace('.', ',')}/venda
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {l.peca_id && (
                        <>
                          <button
                            onClick={() => renomear(l.peca_id!, l.nome)}
                            className="text-xs opacity-40 hover:opacity-100 mr-2"
                            title="Dar um nome que você reconheça depois"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => apagar(l.peca_id!, l.nome)}
                            className="text-xs opacity-40 hover:opacity-100 hover:text-red-400"
                            title="Tirar da lista"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] opacity-45 leading-relaxed">
        O custo por venda é estimado: o investimento da campanha é rateado pela
        fatia de tráfego de cada peça, porque o sistema não recebe o gasto real
        por criativo da plataforma de anúncio.
      </p>
    </div>
  );
}
