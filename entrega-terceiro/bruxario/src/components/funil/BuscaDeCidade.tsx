'use client';

import { useEffect, useMemo, useState } from 'react';

/** Sem acento e em minúscula, para "sao paulo" achar "São Paulo". */
function dobrar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface CidadeEscolhida {
  cidade: string;
  estado: string;
}

/**
 * A cidade de nascimento por **busca**, sem escolher o estado antes.
 *
 * ── Por que este componente existe ao lado de `EscolhaDeCidade` ───────────
 *
 * O outro pede o estado primeiro e só então lista os municípios dele. Isso
 * funciona bem numa tela dedicada dentro da conta, onde a pessoa já decidiu
 * ficar: são duas escolhas curtas e nenhuma digitação.
 *
 * No fim do ritual o custo se inverte. Ali a pessoa acabou de atravessar 26
 * cenas e está a um botão do familiar dela — dois seletores encadeados são
 * dois momentos de "espera, qual mesmo?", e cada um é uma chance de fechar a
 * aba no último passo. Digitar as três primeiras letras e tocar no resultado
 * é um gesto só.
 *
 * ── Buscar em todos os estados de uma vez ─────────────────────────────────
 *
 * São 5.571 nomes; filtrar a lista inteira em memória a cada tecla é
 * instantâneo. O estado vem junto do resultado — a pessoa nunca precisa
 * saber que ele foi perguntado. Homônimos ("Bom Jesus" existe em oito
 * estados) aparecem como linhas separadas com a sigla ao lado, que é
 * exatamente a informação que desempata.
 *
 * ── O que a coordenada faz com isso ───────────────────────────────────────
 *
 * Nada de fino: `src/lib/coordenadas.ts` usa a capital do estado, porque é o
 * ascendente que depende do lugar e ele erra menos com 300 km de longitude do
 * que com a meia hora que a pessoa chuta na hora do nascimento. O nome exato
 * da cidade é guardado assim mesmo — é dela, aparece na carta, e no dia em
 * que houver uma base geocodificada ela já está no banco.
 */
export function BuscaDeCidade({
  valor,
  onEscolher,
}: {
  valor: CidadeEscolhida | null;
  onEscolher: (escolha: CidadeEscolhida | null) => void;
}) {
  const [porEstado, setPorEstado] = useState<Record<string, string[]> | null>(null);
  const [busca, setBusca] = useState('');

  // 28 KB comprimidos: descem quando esta tela aparece, não no primeiro
  // carregamento de quem talvez nem chegue aqui.
  useEffect(() => {
    let vivo = true;
    import('@/lib/cidades.json')
      .then((m) => {
        if (vivo) setPorEstado((m.default ?? m) as Record<string, string[]>);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const resultados = useMemo(() => {
    const termo = dobrar(busca);
    if (termo.length < 2 || !porEstado) return [];
    const achados: CidadeEscolhida[] = [];
    for (const [estado, cidades] of Object.entries(porEstado)) {
      for (const cidade of cidades) {
        const nome = dobrar(cidade);
        // Prefixo primeiro, contido depois: quem digita "sant" quer
        // "Santarém" antes de "Porto de Santana".
        if (nome.startsWith(termo)) achados.unshift({ cidade, estado });
        else if (nome.includes(termo)) achados.push({ cidade, estado });
        if (achados.length > 300) break;
      }
    }
    return achados.slice(0, 8);
  }, [busca, porEstado]);

  if (valor) {
    return (
      <div className="flex items-center justify-between gap-3 border border-ouro-velho/40 bg-ouro-velho/5 rounded-xl px-4 py-3">
        <span className="font-corpo text-sm text-escrita">
          {valor.cidade}
          <span className="text-escrita-fraca"> · {valor.estado}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onEscolher(null);
            setBusca('');
          }}
          className="font-corpo text-xs text-escrita-fraca hover:text-escrita underline underline-offset-4 transition"
        >
          trocar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Comece a digitar a cidade"
        autoComplete="off"
        className="w-full bg-transparent border border-escrita/20 rounded-xl px-4 py-3 font-corpo text-sm text-escrita placeholder:text-escrita-fraca focus:border-ouro-velho outline-none"
      />
      {resultados.length > 0 && (
        <ul className="flex flex-col gap-1 max-h-52 overflow-y-auto">
          {resultados.map((r) => (
            <li key={`${r.estado}:${r.cidade}`}>
              <button
                type="button"
                onClick={() => onEscolher(r)}
                className="w-full text-left font-corpo text-sm text-escrita-corpo hover:text-escrita hover:bg-ouro-velho/10 rounded-lg px-3 py-2 transition"
              >
                {r.cidade}
                <span className="text-escrita-fraca"> · {r.estado}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {busca.trim().length >= 2 && porEstado && resultados.length === 0 && (
        <p className="font-corpo text-xs text-escrita-fraca px-1">
          Nenhuma cidade com esse nome. Tente sem acento, ou a capital mais
          próxima.
        </p>
      )}
    </div>
  );
}
