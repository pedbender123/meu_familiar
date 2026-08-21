'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Estado e cidade em seleção, com palpite pelo fuso do navegador.
 *
 * ── Por que não um campo de texto ─────────────────────────────────────────
 *
 * O campo livre parecia mais simples e é pior em três frentes. No celular ele
 * abre o teclado e exige digitação com acento no meio de um funil que a pessoa
 * está atravessando com o polegar. Ele aceita erro de grafia, que depois
 * aparece impresso na carta dela. E aceita qualquer coisa — "aqui", "não sei",
 * um emoji — que não é dado, é ruído no banco.
 *
 * ── Por que a lista é carregada só aqui ───────────────────────────────────
 *
 * São 5571 municípios, 28 KB comprimidos. Pequeno para um passo, grande demais
 * para viajar no primeiro carregamento de quem talvez nem chegue nele: o
 * `import()` dinâmico faz o arquivo descer quando esta tela aparece, e não
 * antes. Os 27 estados vêm juntos do módulo porque são a primeira escolha e
 * precisam estar prontos.
 *
 * ── O palpite ─────────────────────────────────────────────────────────────
 *
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` diz o fuso do aparelho.
 * Não precisa de rede, não precisa de permissão, não vaza nada — e acerta o
 * ESTADO na maioria dos casos. A cidade continua sendo escolha dela, porque o
 * fuso não sabe: metade do país inteiro está em `America/Sao_Paulo`.
 */
export const ESTADOS: { sigla: string; nome: string }[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

/**
 * Fuso → estado. Os fusos que cobrem mais de um estado apontam o mais
 * populoso, porque é onde o palpite acerta mais — e ele é só um palpite: o
 * seletor abre nele e a pessoa troca em um toque se estiver errado.
 */
const ESTADO_POR_FUSO: Record<string, string> = {
  'America/Sao_Paulo': 'SP',
  'America/Bahia': 'BA',
  'America/Fortaleza': 'CE',
  'America/Recife': 'PE',
  'America/Maceio': 'AL',
  'America/Belem': 'PA',
  'America/Santarem': 'PA',
  'America/Araguaina': 'TO',
  'America/Manaus': 'AM',
  'America/Boa_Vista': 'RR',
  'America/Porto_Velho': 'RO',
  'America/Rio_Branco': 'AC',
  'America/Eirunepe': 'AM',
  'America/Cuiaba': 'MT',
  'America/Campo_Grande': 'MS',
  'America/Noronha': 'PE',
};

export function palpitarEstado(): string {
  try {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return ESTADO_POR_FUSO[fuso] ?? '';
  } catch {
    return '';
  }
}

/** Sem acento e minúsculo, para a busca casar "sao paulo" com "São Paulo". */
function dobrar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function EscolhaDeCidade({
  estado,
  cidade,
  onChange,
  onEscolhida,
}: {
  estado: string;
  cidade: string;
  onChange: (v: { estado: string; cidade: string }) => void;
  /**
   * Chamado quando a cidade é escolhida.
   *
   * Escolher já avança, como em todos os outros passos de escolha única deste
   * funil. Não é só coerência: a lista tem 15rem de altura, então o botão
   * "Continuar" caía abaixo da dobra no celular — a pessoa escolhia, via a
   * cidade marcada, e nada acontecia porque o botão estava fora da tela.
   */
  onEscolhida?: () => void;
}) {
  const [porEstado, setPorEstado] = useState<Record<string, string[]> | null>(null);
  const [busca, setBusca] = useState('');

  // A lista desce quando esta tela aparece, não no carregamento da página.
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

  const cidades = useMemo(() => {
    const lista = (estado && porEstado?.[estado]) || [];
    if (!busca.trim()) return lista;
    const b = dobrar(busca);
    return lista.filter((c) => dobrar(c).includes(b));
  }, [porEstado, estado, busca]);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="font-corpo text-[0.65rem] tracking-[0.18em] uppercase text-escrita-fraca">
          Estado
        </span>
        <div className="relative">
          <select
            value={estado}
            onChange={(e) => {
              // Trocar de estado invalida a cidade — deixá-la ali produziria
              // "Caxias do Sul, SP", que é errado e passaria despercebido.
              onChange({ estado: e.target.value, cidade: '' });
              setBusca('');
            }}
            className="w-full appearance-none entrada-ritual bg-transparent border border-escrita/25 rounded-xl px-4 py-3.5 pr-11 text-lg text-escrita focus:border-ouro-velho outline-none font-corpo"
          >
            <option value="">Escolha…</option>
            {ESTADOS.map((e) => (
              <option key={e.sigla} value={e.sigla}>
                {e.nome}
              </option>
            ))}
          </select>
          <Seta />
        </div>
      </label>

      {estado && (
        <div className="flex flex-col gap-2.5 anima-surgir">
          <span className="font-corpo text-[0.65rem] tracking-[0.18em] uppercase text-escrita-fraca">
            Cidade
          </span>

          {!porEstado ? (
            <p className="font-corpo text-sm text-escrita-fraca py-3">Abrindo o mapa…</p>
          ) : (
            <>
              {/*
                A busca só aparece em estado grande. Em Roraima são 15 cidades e
                um campo de busca ali é um passo a mais para nada; em Minas são
                853 e sem ele a lista é intransitável.
              */}
              {(porEstado[estado]?.length ?? 0) > 40 && (
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="digite para achar"
                  className="entrada-ritual bg-transparent border border-escrita/20 rounded-xl px-4 py-2.5 text-[0.95rem] text-escrita placeholder:text-escrita-fraca/50 focus:border-ouro-velho outline-none font-corpo"
                />
              )}

              <div
                className="flex flex-col overflow-y-auto no-scrollbar rounded-xl border border-escrita/15"
                style={{ maxHeight: '15rem' }}
              >
                {cidades.length === 0 ? (
                  <p className="font-corpo text-sm text-escrita-fraca px-4 py-4 text-center">
                    Nenhuma cidade com “{busca}”.
                  </p>
                ) : (
                  cidades.map((c) => {
                    const ativa = c === cidade;
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          onChange({ estado, cidade: c });
                          onEscolhida?.();
                        }}
                        aria-pressed={ativa}
                        className={[
                          'text-left font-corpo px-4 py-3 border-b border-escrita/8 last:border-b-0 transition-colors',
                          ativa
                            ? 'bg-ouro-velho/15 text-escrita'
                            : 'text-escrita-corpo hover:bg-ouro-velho/6',
                        ].join(' ')}
                      >
                        {c}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Seta() {
  return (
    <svg
      aria-hidden="true"
      className="absolute right-4 top-1/2 -translate-y-1/2 text-escrita-fraca pointer-events-none"
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
