'use client';

import { useState } from 'react';

/**
 * O link publicável de uma campanha, com botão de copiar.
 *
 * ── Por que ele fica visível na página da campanha ────────────────────────
 *
 * Porque o link é a única coisa desta tela que alguém de fora precisa. Tudo o
 * mais aqui é medição nossa; isto é o que vai para o gerenciador de anúncios.
 * Ficar guardado só no instante da criação obrigaria a recriar a campanha —
 * ou a montar o endereço à mão, que é onde se erra o caminho, se esquece o
 * `?c=` e se publica anúncio apontando para a página errada.
 */
export function LinkDaCampanha({
  link,
  nomeDoFunil,
}: {
  link: string;
  nomeDoFunil: string;
}) {
  const [copiado, setCopiado] = useState(false);

  return (
    <section
      className="superficie w-full rounded-xl border px-5 py-4 flex flex-col gap-2.5"
      style={{ borderColor: 'rgba(217,164,65,0.35)' }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-corpo font-medium text-sm text-pergaminho/85">
          O link desta campanha
        </h2>
        <span className="font-corpo text-[11px] text-pergaminho/40">
          entra por: {nomeDoFunil}
        </span>
      </div>

      {/*
        Numa linha só e selecionável: quebrado em várias, um copiar-e-colar
        desavisado leva o espaço junto e a URL chega quebrada no gerenciador —
        erro que só aparece depois de o anúncio já ter gasto dinheiro.
      */}
      <code className="font-mono text-[12px] leading-relaxed text-vela break-all select-all">
        {link}
      </code>

      <div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {
              // Área de transferência bloqueada: o link está na tela.
            }
          }}
          className="font-corpo text-xs px-4 py-2 rounded-full bg-vela text-tinta font-medium hover:brightness-110 transition"
        >
          {copiado ? 'Copiado' : 'Copiar o link'}
        </button>
      </div>
    </section>
  );
}
